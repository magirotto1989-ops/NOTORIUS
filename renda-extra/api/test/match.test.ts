import { describe, expect, it } from 'vitest';
import { estimateMonthlyBRL, matchOpportunity, type MatchOpportunity, type MatchProfile } from '../src/domain/match.js';

const base: MatchProfile = {
  hoursPerWeek: 10,
  modePref: 'HIBRIDO',
  capitalBRL: 200,
  skills: [],
  assets: ['smartphone', 'computador'],
  englishLevel: 0,
  needsFastCash: false,
  wantsDollar: false,
  experience: 0,
};

const opp: MatchOpportunity = {
  mode: 'ONLINE',
  currency: 'BRL',
  hourlyMin: 20,
  hourlyMax: 40,
  startupCostBRL: 0,
  difficulty: 2,
  daysToFirstPay: 14,
  minHoursWeek: 5,
  minEnglish: 0,
  requiredAssets: ['computador'],
  skills: ['escrita'],
};

const opts = { usdBrl: 5, goalBRL: 1000 };

describe('matchOpportunity', () => {
  it('bloqueia quando falta um ativo obrigatório', () => {
    const r = matchOpportunity(base, { ...opp, requiredAssets: ['carro', 'cnh'] }, opts);
    expect(r.eligible).toBe(false);
    expect(r.blockers[0]).toMatch(/Carro/);
    expect(r.score).toBeLessThanOrEqual(25);
  });

  it('aceita requisito alternativo (moto|bicicleta)', () => {
    const r = matchOpportunity({ ...base, assets: ['bicicleta'] }, { ...opp, mode: 'PRESENCIAL', requiredAssets: ['moto|bicicleta'] }, opts);
    expect(r.eligible).toBe(true);
  });

  it('respeita a preferência de modalidade', () => {
    expect(matchOpportunity({ ...base, modePref: 'ONLINE' }, { ...opp, mode: 'PRESENCIAL' }, opts).eligible).toBe(false);
    expect(matchOpportunity({ ...base, modePref: 'ONLINE' }, { ...opp, mode: 'HIBRIDO' }, opts).eligible).toBe(true);
  });

  it('bloqueia por inglês e capital', () => {
    expect(matchOpportunity(base, { ...opp, minEnglish: 2 }, opts).eligible).toBe(false);
    expect(matchOpportunity(base, { ...opp, startupCostBRL: 1000 }, opts).eligible).toBe(false);
  });

  it('pontua mais quem tem as habilidades', () => {
    const without = matchOpportunity(base, opp, opts);
    const withSkill = matchOpportunity({ ...base, skills: ['escrita'] }, opp, opts);
    expect(withSkill.score).toBeGreaterThan(without.score);
    expect(withSkill.reasons.join(' ')).toMatch(/Escrita/);
  });

  it('valoriza pagamento em dólar para quem quer', () => {
    const usd = { ...opp, currency: 'USD' as const, hourlyMin: 4, hourlyMax: 8 };
    const a = matchOpportunity(base, usd, opts);
    const b = matchOpportunity({ ...base, wantsDollar: true }, usd, opts);
    expect(b.score).toBeGreaterThan(a.score);
  });

  it('prioriza pagamento rápido quando há urgência', () => {
    const fast = { ...opp, daysToFirstPay: 3 };
    const slow = { ...opp, daysToFirstPay: 60 };
    const p = { ...base, needsFastCash: true };
    expect(matchOpportunity(p, fast, opts).score).toBeGreaterThan(matchOpportunity(p, slow, opts).score);
  });

  it('score fica entre 0 e 100', () => {
    const r = matchOpportunity({ ...base, skills: ['escrita'], wantsDollar: true, needsFastCash: true, hoursPerWeek: 80 }, { ...opp, currency: 'USD', daysToFirstPay: 1 }, opts);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe('estimateMonthlyBRL', () => {
  it('converte USD e multiplica pelas horas do mês', () => {
    const r = estimateMonthlyBRL({ ...opp, currency: 'USD', hourlyMin: 10, hourlyMax: 20 }, 10, 5);
    expect(r.min).toBe(Math.round(10 * 5 * 10 * 4.33));
    expect(r.max).toBe(Math.round(20 * 5 * 10 * 4.33));
  });
});
