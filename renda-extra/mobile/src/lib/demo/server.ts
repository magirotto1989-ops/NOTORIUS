/**
 * MODO DEMONSTRAÇÃO — imita a API do Renda+ dentro do próprio app, sem servidor.
 * Ativado com EXPO_PUBLIC_DEMO=1 (usado no link público de testes).
 * Os dados ficam salvos só no aparelho/navegador de quem testa.
 * Regras (plano grátis, match, resumo de ganhos) espelham api/src/routes/*.
 */
import { storage } from '../storage';
import catalogJson from './catalog.json';
import metaJson from './meta.json';
import { estimateMonthlyBRL, hourlyInBRL, matchOpportunity, type MatchResult } from './match';
import { FREE_LIMITS } from './meta';

type Currency = 'BRL' | 'USD';
type Status = 'SAVED' | 'IN_PROGRESS' | 'EARNING' | 'PAUSED';
type Opp = (typeof catalogJson)[number];
type Profile = {
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
type DUser = {
  id: string;
  email: string;
  name: string;
  password: string;
  plan: 'FREE' | 'PREMIUM';
  premiumUntil: string | null;
  monthlyGoal: number;
  profile: Profile | null;
  createdAt: string;
};
type DEarning = { id: string; userId: string; slug: string | null; source: string; amount: number; currency: Currency; amountBRL: number; date: string; note: string | null; createdAt: string };
type DB = {
  users: DUser[];
  tracks: { userId: string; slug: string; status: Status; startedAt: string | null; updatedAt: string }[];
  steps: { userId: string; stepId: string; doneAt: string }[];
  earnings: DEarning[];
};

export class DemoError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const KEY = 'rm.demo.db.v1';
const catalog = catalogJson as Opp[];
const USD_BRL = (metaJson as { usdBrl: number }).usdBrl || 5.4;
const ACTIVE: Status[] = ['IN_PROGRESS', 'EARNING'];
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const round = (n: number) => Math.round(n * 100) / 100;

let db: DB | null = null;

async function load(): Promise<DB> {
  if (db) return db;
  const raw = await storage.get(KEY);
  db = raw ? (JSON.parse(raw) as DB) : seed();
  if (!db.users.some((u) => u.email === 'demo@rendamais.app')) db = { ...seed(), ...db, users: [...db.users, ...seed().users] };
  return db;
}
async function save() {
  if (db) await storage.set(KEY, JSON.stringify(db));
}

function thisMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function shiftMonth(m: string, d: number) {
  const [y, mm] = m.split('-').map(Number);
  const x = new Date(y, mm - 1 + d, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}
const monthsBetween = (a: string, b: string) => {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
};

/** Conta demo com perfil, 2 trilhas e 4 meses de ganhos. */
function seed(): DB {
  const id = 'demo-user';
  const now = new Date();
  const earnings: DEarning[] = [];
  for (let m = 3; m >= 0; m--) {
    const n = 4 + (3 - m);
    const lastDay = m === 0 ? Math.max(now.getDate(), 1) : 28;
    for (let k = 0; k < n; k++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, Math.max(1, Math.round(((k + 1) / n) * lastDay)));
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const red = 120 + k * 35 + (3 - m) * 20;
      earnings.push({ id: uid(), userId: id, slug: 'redator-freelancer', source: 'Workana', amount: red, currency: 'BRL', amountBRL: red, date, note: null, createdAt: date });
      if (m <= 1) {
        const ent = 180 + k * 25;
        earnings.push({ id: uid(), userId: id, slug: 'entregador-app', source: 'iFood', amount: ent, currency: 'BRL', amountBRL: ent, date, note: null, createdAt: date });
      }
    }
  }
  const started = new Date(Date.now() - 60 * 86_400_000).toISOString();
  return {
    users: [
      {
        id,
        email: 'demo@rendamais.app',
        name: 'Ana Demo',
        password: 'demo12345',
        plan: 'FREE',
        premiumUntil: null,
        monthlyGoal: 1500,
        createdAt: started,
        profile: {
          hoursPerWeek: 12,
          modePref: 'HIBRIDO',
          capitalBRL: 300,
          skills: ['escrita', 'redes_sociais', 'design'],
          assets: ['computador', 'smartphone', 'moto'],
          englishLevel: 1,
          needsFastCash: true,
          wantsDollar: false,
          experience: 0,
        },
      },
    ],
    tracks: [
      { userId: id, slug: 'redator-freelancer', status: 'EARNING', startedAt: started, updatedAt: started },
      { userId: id, slug: 'entregador-app', status: 'EARNING', startedAt: started, updatedAt: started },
    ],
    steps: [],
    earnings,
  };
}

const isPremium = (u: DUser) => u.plan === 'PREMIUM' && (!u.premiumUntil || new Date(u.premiumUntil) > new Date());
const publicUser = (u: DUser) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: 'USER' as const,
  plan: isPremium(u) ? 'PREMIUM' : 'FREE',
  premiumUntil: u.premiumUntil,
  monthlyGoal: u.monthlyGoal,
  hasProfile: Boolean(u.profile),
  createdAt: u.createdAt,
});
const session = (u: DUser) => ({ user: publicUser(u), accessToken: `demo:${u.id}`, refreshToken: `demo:${u.id}` });

function match(o: Opp, u: DUser | null): MatchResult | null {
  if (!u?.profile) return null;
  return matchOpportunity(u.profile, o as never, { usdBrl: USD_BRL, goalBRL: u.monthlyGoal });
}

function summary(o: Opp, u: DUser | null) {
  const m = match(o, u);
  const h = hourlyInBRL(o as never, USD_BRL);
  return {
    id: o.id,
    slug: o.slug,
    title: o.title,
    tagline: o.tagline,
    category: o.category,
    mode: o.mode,
    region: o.region,
    currency: o.currency,
    icon: o.icon,
    color: o.color,
    hourly: { min: o.hourlyMin, max: o.hourlyMax, currency: o.currency },
    hourlyBRL: { min: Math.round(h.min), max: Math.round(h.max) },
    estMonthlyBRL: m?.estMonthlyBRL ?? estimateMonthlyBRL(o as never, u?.profile?.hoursPerWeek ?? 10, USD_BRL),
    startupCostBRL: o.startupCostBRL,
    difficulty: o.difficulty,
    daysToFirstPay: o.daysToFirstPay,
    flexibility: o.flexibility,
    popularity: o.popularity,
    match: m ? { score: m.score, eligible: m.eligible, reasons: m.reasons, blockers: m.blockers } : null,
  };
}

const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
};

function findOpp(slug: string) {
  const o = catalog.find((x) => x.slug === slug);
  if (!o) throw new DemoError(404, 'NOT_FOUND', 'Oportunidade não encontrada');
  return o;
}

function earningOut(e: DEarning) {
  const o = e.slug ? catalog.find((x) => x.slug === e.slug) : null;
  return {
    id: e.id,
    source: e.source,
    amount: e.amount,
    currency: e.currency,
    amountBRL: e.amountBRL,
    date: e.date,
    note: e.note,
    opportunity: o ? { slug: o.slug, title: o.title, icon: o.icon, color: o.color } : null,
  };
}

function trackStepsOut(o: Opp, u: DUser, d: DB) {
  const done = new Map(d.steps.filter((s) => s.userId === u.id).map((s) => [s.stepId, s.doneAt]));
  const completed = o.steps.filter((s) => done.has(s.id)).length;
  return { done, completed, pct: o.steps.length ? Math.round((completed / o.steps.length) * 100) : 0 };
}

type Req = { method: string; path: string; query: URLSearchParams; body: any; token: string | null };

export async function demoApi(path: string, opts: { method?: string; body?: unknown }, token: string | null) {
  const d = await load();
  const [p, qs] = path.split('?');
  const req: Req = { method: (opts.method ?? 'GET').toUpperCase(), path: p, query: new URLSearchParams(qs ?? ''), body: opts.body ?? {}, token };
  const res = await route(req, d);
  await save();
  return res;
}

function viewer(req: Req, d: DB) {
  const id = req.token?.startsWith('demo:') ? req.token.slice(5) : null;
  return id ? (d.users.find((u) => u.id === id) ?? null) : null;
}
function auth(req: Req, d: DB) {
  const u = viewer(req, d);
  if (!u) throw new DemoError(401, 'UNAUTHORIZED', 'Sessão expirada ou inválida');
  return u;
}
const premiumRequired = (m: string) => new DemoError(402, 'PREMIUM_REQUIRED', m);

async function route(req: Req, d: DB): Promise<unknown> {
  const { method: M, path } = req;
  const seg = path.split('/').filter(Boolean);
  const b = req.body;

  // ---------- meta / auth ----------
  if (path === '/meta') return metaJson;

  if (path === '/auth/register' && M === 'POST') {
    const email = String(b.email ?? '').trim().toLowerCase();
    if (String(b.name ?? '').trim().length < 2) throw new DemoError(400, 'VALIDATION', 'Informe seu nome');
    if (String(b.password ?? '').length < 8) throw new DemoError(400, 'VALIDATION', 'A senha precisa ter pelo menos 8 caracteres');
    if (d.users.some((u) => u.email === email)) throw new DemoError(409, 'EMAIL_IN_USE', 'Este e-mail já tem conta. Faça login.');
    const u: DUser = { id: uid(), email, name: String(b.name).trim(), password: String(b.password), plan: 'FREE', premiumUntil: null, monthlyGoal: 1000, profile: null, createdAt: new Date().toISOString() };
    d.users.push(u);
    return session(u);
  }
  if (path === '/auth/login' && M === 'POST') {
    const u = d.users.find((x) => x.email === String(b.email ?? '').trim().toLowerCase());
    if (!u || u.password !== b.password) throw new DemoError(401, 'UNAUTHORIZED', 'E-mail ou senha incorretos');
    return session(u);
  }
  if (path === '/auth/refresh') {
    const id = String(b.refreshToken ?? '').slice(5);
    const u = d.users.find((x) => x.id === id);
    if (!u) throw new DemoError(401, 'UNAUTHORIZED', 'Sessão expirada');
    return { accessToken: `demo:${u.id}`, refreshToken: `demo:${u.id}` };
  }
  if (path === '/auth/logout') return undefined;

  // ---------- me ----------
  if (seg[0] === 'me') {
    const u = auth(req, d);
    if (path === '/me' && M === 'GET') return { user: publicUser(u), profile: u.profile };
    if (path === '/me' && M === 'PATCH') {
      if (b.name) u.name = String(b.name);
      if (b.monthlyGoal !== undefined) u.monthlyGoal = Number(b.monthlyGoal);
      return { user: publicUser(u) };
    }
    if (path === '/me/profile' && M === 'PUT') {
      const { monthlyGoal, city: _c, ...profile } = b;
      u.profile = profile as Profile;
      if (monthlyGoal) u.monthlyGoal = Number(monthlyGoal);
      return { profile: u.profile };
    }
    if (path === '/me/export') {
      const { password: _p, ...rest } = u;
      return { ...rest, tracks: d.tracks.filter((t) => t.userId === u.id), earnings: d.earnings.filter((e) => e.userId === u.id) };
    }
    if (path === '/me' && M === 'DELETE') {
      if (b.password !== u.password) throw new DemoError(401, 'UNAUTHORIZED', 'Senha incorreta');
      d.users = d.users.filter((x) => x.id !== u.id);
      d.tracks = d.tracks.filter((x) => x.userId !== u.id);
      d.steps = d.steps.filter((x) => x.userId !== u.id);
      d.earnings = d.earnings.filter((x) => x.userId !== u.id);
      return undefined;
    }
  }

  // ---------- oportunidades ----------
  if (seg[0] === 'opportunities') {
    const u = viewer(req, d);
    if (seg[1] === 'platforms' && seg[3] === 'click') {
      const pl = catalog.flatMap((o) => o.platforms).find((x) => x.id === seg[2]);
      if (!pl) throw new DemoError(404, 'NOT_FOUND', 'Plataforma não encontrada');
      return { url: pl.url };
    }
    if (seg[1] === 'recommended') {
      const user = auth(req, d);
      if (!user.profile) throw new DemoError(409, 'PROFILE_REQUIRED', 'Responda o quiz para receber recomendações');
      const limit = Number(req.query.get('limit') ?? 10);
      const items = catalog
        .map((o) => summary(o, user))
        .filter((i) => i.match?.eligible)
        .sort((a, z) => z.match!.score - a.match!.score)
        .slice(0, limit);
      return { items, usdBrl: USD_BRL };
    }
    if (seg[1]) {
      const o = findOpp(seg[1]);
      const premium = u ? isPremium(u) : false;
      const t = u ? d.tracks.find((x) => x.userId === u.id && x.slug === o.slug) : null;
      return {
        ...summary(o, u),
        description: o.description,
        earningsNote: o.earningsNote,
        requiredAssets: o.requiredAssets,
        skills: o.skills,
        minEnglish: o.minEnglish,
        minHoursWeek: o.minHoursWeek,
        pros: o.pros,
        cons: o.cons,
        warnings: o.warnings,
        taxNote: o.taxNote,
        sources: o.sources,
        reviewedAt: o.reviewedAt,
        platforms: o.platforms.map((pl) => ({ id: pl.id, name: pl.name, description: pl.description, caution: pl.caution ?? null, host: host(pl.url) })),
        steps: o.steps.map((s) => ({ id: s.id, order: s.order, title: s.title, locked: s.premium && !premium })),
        track: t ? { status: t.status, startedAt: t.startedAt } : null,
      };
    }
    // lista
    const q = req.query;
    let rows = catalog.slice();
    const cats = q.get('category')?.split(',');
    if (cats) rows = rows.filter((o) => cats.includes(o.category));
    const mode = q.get('mode');
    if (mode === 'ONLINE') rows = rows.filter((o) => o.mode !== 'PRESENCIAL');
    else if (mode === 'PRESENCIAL') rows = rows.filter((o) => o.mode !== 'ONLINE');
    if (q.get('currency')) rows = rows.filter((o) => o.currency === q.get('currency'));
    if (q.get('maxStartup') !== null) rows = rows.filter((o) => o.startupCostBRL <= Number(q.get('maxStartup')));
    if (q.get('fastPay')) rows = rows.filter((o) => o.daysToFirstPay <= 14);
    const term = q.get('q')?.toLowerCase();
    if (term) {
      const norm = (s: string) => s.toLowerCase();
      rows = rows.filter((o) => [o.title, o.tagline, o.description, ...o.platforms.map((x) => x.name)].some((s) => norm(s).includes(term)));
    }
    let items = rows.map((o) => summary(o, u));
    if (q.get('eligibleOnly')) items = items.filter((i) => i.match?.eligible !== false);
    const avg = (i: (typeof items)[number]) => (i.estMonthlyBRL.min + i.estMonthlyBRL.max) / 2;
    const sorters: Record<string, (a: (typeof items)[number], z: (typeof items)[number]) => number> = {
      match: (a, z) => (z.match?.score ?? z.popularity) - (a.match?.score ?? a.popularity),
      earnings: (a, z) => avg(z) - avg(a),
      fast: (a, z) => a.daysToFirstPay - z.daysToFirstPay,
      popular: (a, z) => z.popularity - a.popularity,
      cheap: (a, z) => a.startupCostBRL - z.startupCostBRL,
    };
    items.sort(sorters[q.get('sort') ?? 'match'] ?? sorters.match);
    return { items, total: items.length, usdBrl: USD_BRL, personalized: Boolean(u?.profile) };
  }

  // ---------- trilhas ----------
  if (seg[0] === 'tracks') {
    const u = auth(req, d);
    if (!seg[1]) {
      const items = d.tracks
        .filter((t) => t.userId === u.id)
        .sort((a, z) => z.updatedAt.localeCompare(a.updatedAt))
        .map((t) => {
          const o = findOpp(t.slug);
          const pr = trackStepsOut(o, u, d);
          return { slug: o.slug, title: o.title, icon: o.icon, color: o.color, category: o.category, status: t.status, startedAt: t.startedAt, progress: { completed: pr.completed, total: o.steps.length, pct: pr.pct } };
        });
      return { items };
    }
    const o = findOpp(seg[1]);
    const existing = d.tracks.find((t) => t.userId === u.id && t.slug === o.slug);

    if (seg[2] === 'steps' && seg[3]) {
      const step = o.steps.find((s) => s.id === seg[3]);
      if (!step) throw new DemoError(404, 'NOT_FOUND', 'Etapa não encontrada');
      if (step.premium && !isPremium(u)) throw premiumRequired('Esta etapa faz parte do conteúdo Premium.');
      d.steps = d.steps.filter((s) => !(s.userId === u.id && s.stepId === step.id));
      if (b.done) {
        d.steps.push({ userId: u.id, stepId: step.id, doneAt: new Date().toISOString() });
        if (!existing) d.tracks.push({ userId: u.id, slug: o.slug, status: 'SAVED', startedAt: null, updatedAt: new Date().toISOString() });
      }
      return { ok: true, done: Boolean(b.done) };
    }
    if (M === 'PUT') {
      const status = b.status as Status;
      const becomingActive = ACTIVE.includes(status) && !ACTIVE.includes(existing?.status as Status);
      if (becomingActive && !isPremium(u)) {
        const active = d.tracks.filter((t) => t.userId === u.id && ACTIVE.includes(t.status)).length;
        if (active >= FREE_LIMITS.activeTracks) throw premiumRequired(`No plano grátis você pode ter até ${FREE_LIMITS.activeTracks} trilhas ativas. Pause uma ou assine o Premium.`);
      }
      const startedAt = existing?.startedAt ?? (ACTIVE.includes(status) ? new Date().toISOString() : null);
      if (existing) Object.assign(existing, { status, startedAt, updatedAt: new Date().toISOString() });
      else d.tracks.push({ userId: u.id, slug: o.slug, status, startedAt, updatedAt: new Date().toISOString() });
      return { track: { status, startedAt } };
    }
    if (M === 'DELETE') {
      d.tracks = d.tracks.filter((t) => !(t.userId === u.id && t.slug === o.slug));
      return undefined;
    }
    const premium = isPremium(u);
    const pr = trackStepsOut(o, u, d);
    return {
      slug: o.slug,
      title: o.title,
      icon: o.icon,
      color: o.color,
      track: existing ? { status: existing.status, startedAt: existing.startedAt } : null,
      progress: { completed: pr.completed, total: o.steps.length, pct: pr.pct },
      platforms: o.platforms.map((x) => ({ id: x.id, name: x.name })),
      steps: o.steps.map((s) => {
        const locked = s.premium && !premium;
        return { id: s.id, order: s.order, title: s.title, content: locked ? null : s.content, locked, done: pr.done.has(s.id), doneAt: pr.done.get(s.id) ?? null };
      }),
    };
  }

  // ---------- ganhos ----------
  if (seg[0] === 'earnings') {
    const u = auth(req, d);
    const premium = isPremium(u);
    const mine = d.earnings.filter((e) => e.userId === u.id);
    const assertHistory = (m: string) => {
      if (!premium && monthsBetween(m, thisMonth()) >= FREE_LIMITS.earningsHistoryMonths)
        throw premiumRequired(`No plano grátis o histórico mostra os últimos ${FREE_LIMITS.earningsHistoryMonths} meses.`);
    };

    if (seg[1] === 'export.csv') {
      if (!premium) throw premiumRequired('Exportação em planilha é um recurso Premium.');
      const esc = (s: string) => `"${s.replaceAll('"', '""')}"`;
      return (
        '﻿data;fonte;oportunidade;moeda;valor;valor_brl;observacao\n' +
        mine
          .sort((a, z) => a.date.localeCompare(z.date))
          .map((e) => [e.date, esc(e.source), esc(earningOut(e).opportunity?.title ?? ''), e.currency, e.amount.toFixed(2).replace('.', ','), e.amountBRL.toFixed(2).replace('.', ','), esc(e.note ?? '')].join(';'))
          .join('\n')
      );
    }

    if (seg[1] === 'summary') {
      const month = req.query.get('month') ?? thisMonth();
      assertHistory(month);
      const span = premium ? 12 : FREE_LIMITS.earningsHistoryMonths;
      const first = shiftMonth(month, -(span - 1));
      const series = Array.from({ length: span }, (_, i) => ({ month: shiftMonth(first, i), total: 0 }));
      const by = new Map<string, { source: string; total: number; color: string | null; icon: string | null }>();
      let total = 0;
      let count = 0;
      for (const e of mine) {
        const m = e.date.slice(0, 7);
        const s = series.find((x) => x.month === m);
        if (s) s.total += e.amountBRL;
        if (m === month) {
          total += e.amountBRL;
          count++;
          const o = earningOut(e).opportunity;
          const key = o?.title ?? e.source;
          const cur = by.get(key) ?? { source: key, total: 0, color: o?.color ?? null, icon: o?.icon ?? null };
          cur.total += e.amountBRL;
          by.set(key, cur);
        }
      }
      const prev = series.length > 1 ? series[series.length - 2].total : 0;
      let projection: number | null = null;
      if (month === thisMonth()) {
        const now = new Date();
        const day = now.getDate();
        const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        if (day >= 7) projection = round((total / day) * dim);
      }
      return {
        month,
        total: round(total),
        entries: count,
        goal: u.monthlyGoal,
        goalPct: u.monthlyGoal ? Math.round((total / u.monthlyGoal) * 100) : 0,
        projection,
        previousMonthTotal: round(prev),
        deltaPct: prev ? Math.round(((total - prev) / prev) * 100) : null,
        series: series.map((s) => ({ ...s, total: round(s.total) })),
        bySource: [...by.values()].map((s) => ({ ...s, total: round(s.total) })).sort((a, z) => z.total - a.total),
        historyLimited: !premium,
      };
    }

    if (!seg[1] && M === 'GET') {
      const month = req.query.get('month') ?? thisMonth();
      assertHistory(month);
      return {
        month,
        items: mine
          .filter((e) => e.date.startsWith(month))
          .sort((a, z) => z.date.localeCompare(a.date) || z.createdAt.localeCompare(a.createdAt))
          .map(earningOut),
      };
    }

    const validate = (x: any, partial = false) => {
      if (!partial || x.amount !== undefined) if (!(Number(x.amount) > 0)) throw new DemoError(400, 'VALIDATION', 'Informe um valor maior que zero');
      if (!partial || x.source !== undefined) if (!String(x.source ?? '').trim()) throw new DemoError(400, 'VALIDATION', 'Informe a fonte');
      if (!partial || x.date !== undefined) if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x.date))) throw new DemoError(400, 'VALIDATION', 'Use o formato AAAA-MM-DD');
    };

    if (!seg[1] && M === 'POST') {
      validate(b);
      const currency: Currency = b.currency === 'USD' ? 'USD' : 'BRL';
      const amount = Number(b.amount);
      const e: DEarning = {
        id: uid(),
        userId: u.id,
        slug: b.opportunitySlug || null,
        source: String(b.source).trim(),
        amount,
        currency,
        amountBRL: round(amount * (currency === 'USD' ? USD_BRL : 1)),
        date: b.date,
        note: b.note || null,
        createdAt: new Date().toISOString(),
      };
      d.earnings.push(e);
      if (e.slug) {
        const t = d.tracks.find((x) => x.userId === u.id && x.slug === e.slug);
        if (t && (t.status === 'SAVED' || t.status === 'IN_PROGRESS')) t.status = 'EARNING';
      }
      return { item: earningOut(e) };
    }

    const e = mine.find((x) => x.id === seg[1]);
    if (!e) throw new DemoError(404, 'NOT_FOUND', 'Lançamento não encontrado');
    if (M === 'DELETE') {
      d.earnings = d.earnings.filter((x) => x.id !== e.id);
      return undefined;
    }
    if (M === 'PATCH') {
      validate(b, true);
      if (b.source !== undefined) e.source = String(b.source).trim();
      if (b.currency) e.currency = b.currency;
      if (b.amount !== undefined) e.amount = Number(b.amount);
      if (b.date) e.date = b.date;
      if (b.note !== undefined) e.note = b.note || null;
      if (b.opportunitySlug !== undefined) e.slug = b.opportunitySlug || null;
      e.amountBRL = round(e.amount * (e.currency === 'USD' ? USD_BRL : 1));
      return { item: earningOut(e) };
    }
  }

  // ---------- assinatura (demonstração) ----------
  if (path === '/billing/dev-activate') {
    const u = auth(req, d);
    if (b.cancel) Object.assign(u, { plan: 'FREE', premiumUntil: null });
    else Object.assign(u, { plan: 'PREMIUM', premiumUntil: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    return { user: publicUser(u) };
  }

  if (seg[0] === 'admin') throw new DemoError(403, 'FORBIDDEN', 'Apenas administradores');
  throw new DemoError(404, 'NOT_FOUND', 'Rota não encontrada');
}
