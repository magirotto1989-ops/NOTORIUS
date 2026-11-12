import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { prisma } from '../src/db.js';
import { currentMonth, shiftMonth } from '../src/routes/earnings.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp(loadEnv());
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function signup(email = `u${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.dev`) {
  const res = await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'Teste', email, password: 'senha-segura-1' } });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  return { ...body, auth: { authorization: `Bearer ${body.accessToken}` }, email };
}

const quiz = {
  hoursPerWeek: 10,
  modePref: 'ONLINE',
  capitalBRL: 0,
  skills: ['escrita'],
  assets: ['computador', 'smartphone'],
  englishLevel: 0,
  needsFastCash: true,
  wantsDollar: false,
  experience: 0,
  monthlyGoal: 1500,
};

describe('CORS (versão web)', () => {
  it('libera PUT/PATCH/DELETE no preflight', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/me/profile',
      headers: { origin: 'http://localhost:8081', 'access-control-request-method': 'PUT' },
    });
    expect(res.statusCode).toBe(204);
    const allowed = String(res.headers['access-control-allow-methods']);
    for (const m of ['PUT', 'PATCH', 'DELETE']) expect(allowed).toContain(m);
  });
});

describe('auth', () => {
  it('cadastra, faz login e rotaciona refresh token', async () => {
    const s = await signup();
    expect(s.user.plan).toBe('FREE');

    const dup = await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'Xavier', email: s.email, password: 'senha-segura-1' } });
    expect(dup.statusCode).toBe(409);

    const bad = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: s.email, password: 'errada' } });
    expect(bad.statusCode).toBe(401);

    const ok = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: s.email, password: 'senha-segura-1' } });
    expect(ok.statusCode).toBe(200);

    const r1 = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: s.refreshToken } });
    expect(r1.statusCode).toBe(200);
    // reuso do token antigo é rejeitado e derruba as sessões
    const reuse = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: s.refreshToken } });
    expect(reuse.statusCode).toBe(401);
    const r2 = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: r1.json().refreshToken } });
    expect(r2.statusCode).toBe(401);
  });

  it('valida entrada com mensagens em português', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'A', email: 'x', password: '1' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('VALIDATION');
  });

  it('exige token nas rotas privadas', async () => {
    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
  });
});

describe('quiz e recomendações', () => {
  it('recomenda apenas oportunidades elegíveis ao perfil', async () => {
    const s = await signup();
    const pre = await app.inject({ method: 'GET', url: '/opportunities/recommended', headers: s.auth });
    expect(pre.statusCode).toBe(409);

    const put = await app.inject({ method: 'PUT', url: '/me/profile', headers: s.auth, payload: quiz });
    expect(put.statusCode).toBe(200);

    const rec = await app.inject({ method: 'GET', url: '/opportunities/recommended?limit=50', headers: s.auth });
    const items = rec.json().items as { slug: string; mode: string; match: { score: number; eligible: boolean } }[];
    expect(items.length).toBeGreaterThan(3);
    expect(items.every((i) => i.match.eligible && i.mode !== 'PRESENCIAL')).toBe(true);
    expect(items.map((i) => i.slug)).not.toContain('motorista-app');
    expect(items.map((i) => i.slug)).not.toContain('professor-idiomas-online'); // exige inglês avançado
    const scores = items.map((i) => i.match.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('catálogo público filtra e busca', async () => {
    const all = await app.inject({ method: 'GET', url: '/opportunities' });
    expect(all.json().total).toBeGreaterThanOrEqual(30);
    expect(all.json().personalized).toBe(false);

    const usd = await app.inject({ method: 'GET', url: '/opportunities?currency=USD' });
    expect(usd.json().items.every((i: { currency: string }) => i.currency === 'USD')).toBe(true);

    const search = await app.inject({ method: 'GET', url: '/opportunities?q=ifood' });
    expect(search.json().items.map((i: { slug: string }) => i.slug)).toContain('entregador-app');

    const cheap = await app.inject({ method: 'GET', url: '/opportunities?maxStartup=0&sort=fast' });
    const c = cheap.json().items as { startupCostBRL: number; daysToFirstPay: number }[];
    expect(c.every((i) => i.startupCostBRL === 0)).toBe(true);
    expect(c[0].daysToFirstPay).toBeLessThanOrEqual(c[c.length - 1].daysToFirstPay);
  });

  it('detalhe traz plataformas e etapas com bloqueio premium', async () => {
    const res = await app.inject({ method: 'GET', url: '/opportunities/redator-freelancer' });
    const o = res.json();
    expect(o.platforms.length).toBeGreaterThan(0);
    expect(o.steps.some((s: { locked: boolean }) => s.locked)).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/opportunities/nao-existe' })).statusCode).toBe(404);
  });
});

describe('afiliados', () => {
  it('registra clique e usa link de afiliado quando cadastrado', async () => {
    const admin = await signup('admin@test.dev');
    expect(admin.user.role).toBe('ADMIN');
    const detail = (await app.inject({ method: 'GET', url: '/opportunities/afiliado-marketplaces' })).json();
    const platformId = detail.platforms[0].id;

    const before = (await app.inject({ method: 'POST', url: `/opportunities/platforms/${platformId}/click` })).json();
    expect(before.url).toMatch(/^https:\/\//);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/admin/platforms/${platformId}`,
      headers: admin.auth,
      payload: { affiliateUrl: 'https://example.com/?ref=rendamais' },
    });
    expect(patch.statusCode).toBe(200);
    const after = (await app.inject({ method: 'POST', url: `/opportunities/platforms/${platformId}/click` })).json();
    expect(after.url).toBe('https://example.com/?ref=rendamais');

    const user = await signup();
    expect((await app.inject({ method: 'GET', url: '/admin/stats', headers: user.auth })).statusCode).toBe(403);
    const stats = (await app.inject({ method: 'GET', url: '/admin/stats', headers: admin.auth })).json();
    expect(stats.clicksLast30d.length).toBeGreaterThan(0);
  });
});

describe('trilhas e plano grátis', () => {
  it('limita trilhas ativas no plano grátis e libera no premium', async () => {
    const s = await signup();
    for (const slug of ['redator-freelancer', 'designer-freelancer']) {
      const r = await app.inject({ method: 'PUT', url: `/tracks/${slug}`, headers: s.auth, payload: { status: 'IN_PROGRESS' } });
      expect(r.statusCode).toBe(200);
    }
    const third = await app.inject({ method: 'PUT', url: '/tracks/assistente-virtual', headers: s.auth, payload: { status: 'IN_PROGRESS' } });
    expect(third.statusCode).toBe(402);
    expect(third.json().error).toBe('PREMIUM_REQUIRED');

    // salvar como favorito continua livre
    expect((await app.inject({ method: 'PUT', url: '/tracks/assistente-virtual', headers: s.auth, payload: { status: 'SAVED' } })).statusCode).toBe(200);

    const track = (await app.inject({ method: 'GET', url: '/tracks/redator-freelancer', headers: s.auth })).json();
    const free = track.steps.find((x: { locked: boolean }) => !x.locked);
    const locked = track.steps.find((x: { locked: boolean }) => x.locked);
    expect(locked.content).toBeNull();

    expect((await app.inject({ method: 'POST', url: `/tracks/redator-freelancer/steps/${free.id}`, headers: s.auth, payload: { done: true } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/tracks/redator-freelancer/steps/${locked.id}`, headers: s.auth, payload: { done: true } })).statusCode).toBe(402);

    const list = (await app.inject({ method: 'GET', url: '/tracks', headers: s.auth })).json();
    const red = list.items.find((i: { slug: string }) => i.slug === 'redator-freelancer');
    expect(red.progress.completed).toBe(1);

    await app.inject({ method: 'POST', url: '/billing/dev-activate', headers: s.auth, payload: {} });
    expect((await app.inject({ method: 'PUT', url: '/tracks/assistente-virtual', headers: s.auth, payload: { status: 'IN_PROGRESS' } })).statusCode).toBe(200);
    const full = (await app.inject({ method: 'GET', url: '/tracks/redator-freelancer', headers: s.auth })).json();
    expect(full.steps.every((x: { content: string | null }) => x.content)).toBe(true);
  });
});

describe('ganhos', () => {
  it('lança, resume, converte dólar e respeita o histórico do plano', async () => {
    const s = await signup();
    await app.inject({ method: 'PATCH', url: '/me', headers: s.auth, payload: { monthlyGoal: 1000 } });
    const month = currentMonth();
    const day = `${month}-01`;

    const a = await app.inject({ method: 'POST', url: '/earnings', headers: s.auth, payload: { amount: 250.5, source: 'Workana', date: day, opportunitySlug: 'redator-freelancer' } });
    expect(a.statusCode).toBe(201);
    const b = await app.inject({ method: 'POST', url: '/earnings', headers: s.auth, payload: { amount: 10, currency: 'USD', source: 'Outlier', date: day } });
    expect(b.json().item.amountBRL).toBe(54); // fallback 5,40 em teste

    const bad = await app.inject({ method: 'POST', url: '/earnings', headers: s.auth, payload: { amount: -1, source: 'x', date: day } });
    expect(bad.statusCode).toBe(400);

    const sum = (await app.inject({ method: 'GET', url: '/earnings/summary', headers: s.auth })).json();
    expect(sum.total).toBe(304.5);
    expect(sum.goalPct).toBe(30);
    expect(sum.series).toHaveLength(3);
    expect(sum.bySource[0].source).toBe('Redator(a) freelancer');

    // registrar ganho numa trilha marca como "faturando"
    const tracks = (await app.inject({ method: 'GET', url: '/tracks', headers: s.auth })).json();
    expect(tracks.items).toHaveLength(0); // não havia trilha criada → nada muda

    const old = await app.inject({ method: 'GET', url: `/earnings?month=${shiftMonth(month, -5)}`, headers: s.auth });
    expect(old.statusCode).toBe(402);
    expect((await app.inject({ method: 'GET', url: '/earnings/export.csv', headers: s.auth })).statusCode).toBe(402);

    // outro usuário não enxerga nem apaga
    const other = await signup();
    const del = await app.inject({ method: 'DELETE', url: `/earnings/${a.json().item.id}`, headers: other.auth });
    expect(del.statusCode).toBe(404);

    await app.inject({ method: 'POST', url: '/billing/dev-activate', headers: s.auth, payload: {} });
    const csv = await app.inject({ method: 'GET', url: '/earnings/export.csv', headers: s.auth });
    expect(csv.statusCode).toBe(200);
    expect(csv.body).toContain('Workana');
    const sumPremium = (await app.inject({ method: 'GET', url: '/earnings/summary', headers: s.auth })).json();
    expect(sumPremium.series).toHaveLength(12);
  });
});

describe('billing webhook (RevenueCat)', () => {
  it('ativa e expira premium, com idempotência e autenticação', async () => {
    const s = await signup();
    const event = (id: string, type: string, exp?: number) => ({
      event: { id, type, app_user_id: s.user.id, expiration_at_ms: exp ?? null, entitlement_ids: ['premium'] },
    });

    const unauth = await app.inject({ method: 'POST', url: '/billing/revenuecat/webhook', payload: event('e0', 'INITIAL_PURCHASE') });
    expect(unauth.statusCode).toBe(401);

    const headers = { authorization: 'Bearer rc-test' };
    const exp = Date.now() + 30 * 86_400_000;
    expect((await app.inject({ method: 'POST', url: '/billing/revenuecat/webhook', headers, payload: event('e1', 'INITIAL_PURCHASE', exp) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/me', headers: s.auth })).json().user.plan).toBe('PREMIUM');

    const dup = await app.inject({ method: 'POST', url: '/billing/revenuecat/webhook', headers, payload: event('e1', 'INITIAL_PURCHASE', exp) });
    expect(dup.json().duplicate).toBe(true);

    await app.inject({ method: 'POST', url: '/billing/revenuecat/webhook', headers, payload: event('e2', 'EXPIRATION') });
    expect((await app.inject({ method: 'GET', url: '/me', headers: s.auth })).json().user.plan).toBe('FREE');
  });
});

describe('LGPD', () => {
  it('exporta e exclui a conta com confirmação de senha', async () => {
    const s = await signup();
    const exp = await app.inject({ method: 'GET', url: '/me/export', headers: s.auth });
    expect(exp.json().passwordHash).toBeUndefined();
    expect((await app.inject({ method: 'DELETE', url: '/me', headers: s.auth, payload: { password: 'errada' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'DELETE', url: '/me', headers: s.auth, payload: { password: 'senha-segura-1' } })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/me', headers: s.auth })).statusCode).toBe(401);
  });
});
