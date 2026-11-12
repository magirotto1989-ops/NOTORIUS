// Cópia de api/src/domain/match.ts usada pelo modo demonstração (sem servidor). Mantenha as duas em sincronia.
import { ASSETS, SKILLS, type AssetKey, type SkillKey } from './meta';

/**
 * Motor de recomendação. Função pura (sem banco) para ser testável.
 *
 * Ideia: primeiro aplicamos filtros "duros" (o que impede a pessoa de começar:
 * ativo obrigatório, inglês, capital, modalidade). Depois pontuamos o que sobra
 * por aderência de habilidades, potencial de atingir a meta, rapidez do primeiro
 * pagamento e dificuldade compatível com a experiência.
 */

export type MatchProfile = {
  hoursPerWeek: number;
  modePref: 'ONLINE' | 'PRESENCIAL' | 'HIBRIDO';
  capitalBRL: number;
  skills: string[];
  assets: string[];
  englishLevel: number;
  needsFastCash: boolean;
  wantsDollar: boolean;
  experience: number;
};

export type MatchOpportunity = {
  mode: 'ONLINE' | 'PRESENCIAL' | 'HIBRIDO';
  currency: 'BRL' | 'USD';
  hourlyMin: number;
  hourlyMax: number;
  startupCostBRL: number;
  difficulty: number;
  daysToFirstPay: number;
  minHoursWeek: number;
  minEnglish: number;
  requiredAssets: string[];
  skills: string[];
};

export type MatchResult = {
  score: number; // 0..100
  eligible: boolean;
  reasons: string[];
  blockers: string[];
  estMonthlyBRL: { min: number; max: number };
};

const WEEKS_PER_MONTH = 4.33;

export function hourlyInBRL(o: Pick<MatchOpportunity, 'hourlyMin' | 'hourlyMax' | 'currency'>, usdBrl: number) {
  const k = o.currency === 'USD' ? usdBrl : 1;
  return { min: o.hourlyMin * k, max: o.hourlyMax * k };
}

export function estimateMonthlyBRL(o: MatchOpportunity, hoursPerWeek: number, usdBrl: number) {
  const h = hourlyInBRL(o, usdBrl);
  const hours = Math.max(hoursPerWeek, 1) * WEEKS_PER_MONTH;
  return { min: Math.round(h.min * hours), max: Math.round(h.max * hours) };
}

const label = (k: string) =>
  (SKILLS as Record<string, { label: string }>)[k]?.label ??
  (ASSETS as Record<string, { label: string }>)[k]?.label ??
  k;

export function matchOpportunity(
  p: MatchProfile,
  o: MatchOpportunity,
  opts: { usdBrl: number; goalBRL: number },
): MatchResult {
  const reasons: string[] = [];
  const blockers: string[] = [];

  // ---- Filtros duros -------------------------------------------------------
  if (p.modePref === 'ONLINE' && o.mode === 'PRESENCIAL') blockers.push('É presencial e você prefere trabalhar de casa');
  if (p.modePref === 'PRESENCIAL' && o.mode === 'ONLINE') blockers.push('É 100% online e você prefere atuar na rua');

  const missingAssets = o.requiredAssets.filter((a) => !satisfiesAsset(a, p.assets));
  if (missingAssets.length) blockers.push(`Requer: ${missingAssets.map(label).join(', ')}`);

  if (o.minEnglish > p.englishLevel) blockers.push('Exige um nível de inglês acima do seu');

  // Capital: até 20% acima do disponível ainda é "esticável"; além disso bloqueia.
  if (o.startupCostBRL > p.capitalBRL * 1.2 && o.startupCostBRL > 50)
    blockers.push(`Investimento inicial (~R$ ${o.startupCostBRL}) acima do seu orçamento`);

  // ---- Pontuação -----------------------------------------------------------
  let score = 0;

  // 1) Habilidades (até 35 pts). Oportunidades sem habilidade específica são "porta de entrada".
  if (o.skills.length === 0) {
    score += 22;
    reasons.push('Não exige experiência prévia');
  } else {
    const hits = o.skills.filter((s) => p.skills.includes(s as SkillKey));
    const ratio = hits.length / o.skills.length;
    score += Math.round(10 + 25 * ratio);
    if (hits.length) reasons.push(`Usa o que você já sabe: ${hits.map(label).join(', ')}`);
  }

  // 2) Potencial de renda vs. meta (até 25 pts)
  const est = estimateMonthlyBRL(o, p.hoursPerWeek, opts.usdBrl);
  const mid = (est.min + est.max) / 2;
  const goal = Math.max(opts.goalBRL, 1);
  const reach = Math.min(mid / goal, 1.5);
  score += Math.round((reach / 1.5) * 25);
  if (mid >= goal) reasons.push('Com suas horas, tem potencial de bater sua meta mensal');

  // 3) Tempo disponível (até 10 pts)
  if (p.hoursPerWeek >= o.minHoursWeek) score += 10;
  else {
    score += Math.round((p.hoursPerWeek / o.minHoursWeek) * 5);
    reasons.push(`Rende melhor com ${o.minHoursWeek}h+ por semana`);
  }

  // 4) Rapidez do 1º pagamento (até 15 pts; peso dobrado se precisa de dinheiro rápido)
  const speed = o.daysToFirstPay <= 7 ? 1 : o.daysToFirstPay <= 30 ? 0.6 : o.daysToFirstPay <= 60 ? 0.3 : 0.1;
  score += Math.round(speed * (p.needsFastCash ? 15 : 8));
  if (p.needsFastCash && speed >= 0.6) reasons.push('Primeiro pagamento costuma vir rápido');

  // 5) Dificuldade compatível com a experiência (até 10 pts)
  const comfortable = p.experience === 0 ? 2 : p.experience === 1 ? 3 : 5;
  score += o.difficulty <= comfortable ? 10 : Math.max(0, 10 - (o.difficulty - comfortable) * 4);

  // 6) Preferências (até 5 pts)
  if (p.wantsDollar && o.currency === 'USD') {
    score += 5;
    reasons.push('Paga em dólar');
  }
  if (o.startupCostBRL === 0) score += 2;

  score = Math.max(0, Math.min(100, score));
  const eligible = blockers.length === 0;

  return {
    score: eligible ? score : Math.min(score, 25),
    eligible,
    reasons: reasons.slice(0, 4),
    blockers,
    estMonthlyBRL: est,
  };
}

/** "moto|carro" significa "um ou outro". */
function satisfiesAsset(requirement: string, owned: string[]) {
  return requirement.split('|').some((a) => owned.includes(a as AssetKey));
}
