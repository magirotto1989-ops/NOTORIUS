import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { FREE_LIMITS } from '../domain/meta.js';
import { notFound, premiumRequired } from '../lib/errors.js';
import { getUsdBrl } from '../lib/fx.js';
import { isPremium } from '../lib/plan.js';
import { currentUser } from '../lib/session.js';

/** Datas são armazenadas ao meio-dia UTC para que o "dia" nunca mude por fuso. */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')
  .transform((s) => new Date(`${s}T12:00:00.000Z`));

const monthParam = z.string().regex(/^\d{4}-\d{2}$/, 'Use o formato AAAA-MM');

const entryBody = z.object({
  amount: z.number().positive('Informe um valor maior que zero').max(10_000_000),
  currency: z.enum(['BRL', 'USD']).default('BRL'),
  source: z.string().trim().min(1, 'Informe a fonte').max(60),
  opportunitySlug: z.string().optional().nullable(),
  date: dateOnly,
  note: z.string().trim().max(240).optional().nullable(),
});

/** Mês corrente no fuso de Brasília. */
export function currentMonth(now = new Date()) {
  const br = new Date(now.getTime() - 3 * 3600_000);
  return `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthsBetween(a: string, b: string) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

export async function earningRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  const fx = () => getUsdBrl({ url: app.env.FX_API_URL, fallback: app.env.USD_BRL_FALLBACK, offline: app.env.NODE_ENV === 'test' });

  function assertHistoryAllowed(month: string, premium: boolean) {
    if (premium) return;
    if (monthsBetween(month, currentMonth()) >= FREE_LIMITS.earningsHistoryMonths) {
      throw premiumRequired(`No plano grátis o histórico mostra os últimos ${FREE_LIMITS.earningsHistoryMonths} meses.`);
    }
  }

  async function resolveOpportunityId(slug?: string | null) {
    if (!slug) return null;
    const o = await prisma.opportunity.findUnique({ where: { slug }, select: { id: true } });
    return o?.id ?? null;
  }

  const serialize = (e: Awaited<ReturnType<typeof prisma.earning.findFirstOrThrow>> & { opportunity?: { slug: string; title: string; icon: string; color: string } | null }) => ({
    id: e.id,
    source: e.source,
    amount: e.amountCents / 100,
    currency: e.currency,
    amountBRL: e.amountBRLCents / 100,
    date: e.date.toISOString().slice(0, 10),
    note: e.note,
    opportunity: e.opportunity ? { slug: e.opportunity.slug, title: e.opportunity.title, icon: e.opportunity.icon, color: e.opportunity.color } : null,
  });

  const oppSelect = { select: { slug: true, title: true, icon: true, color: true } } as const;

  app.get('/', async (req) => {
    const { month = currentMonth() } = z.object({ month: monthParam.optional() }).parse(req.query);
    const user = await currentUser(req);
    assertHistoryAllowed(month, isPremium(user));
    const rows = await prisma.earning.findMany({
      where: { userId: user.id, date: monthRange(month) },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { opportunity: oppSelect },
    });
    return { month, items: rows.map(serialize) };
  });

  app.post('/', async (req, reply) => {
    const body = entryBody.parse(req.body);
    const rate = body.currency === 'USD' ? await fx() : 1;
    const amountCents = Math.round(body.amount * 100);
    const row = await prisma.earning.create({
      data: {
        userId: req.user.sub,
        source: body.source,
        amountCents,
        currency: body.currency,
        amountBRLCents: Math.round(amountCents * rate),
        date: body.date,
        note: body.note ?? null,
        opportunityId: await resolveOpportunityId(body.opportunitySlug),
      },
      include: { opportunity: oppSelect },
    });
    // Primeiro ganho registrado numa trilha => status "já faturando".
    if (row.opportunityId) {
      await prisma.userTrack.updateMany({
        where: { userId: req.user.sub, opportunityId: row.opportunityId, status: { in: ['SAVED', 'IN_PROGRESS'] } },
        data: { status: 'EARNING' },
      });
    }
    return reply.status(201).send({ item: serialize(row) });
  });

  app.patch('/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = entryBody.partial().parse(req.body);
    const existing = await prisma.earning.findFirst({ where: { id, userId: req.user.sub } });
    if (!existing) throw notFound('Lançamento');

    const currency = body.currency ?? existing.currency;
    const amountCents = body.amount !== undefined ? Math.round(body.amount * 100) : existing.amountCents;
    const rate = currency === 'USD' ? await fx() : 1;
    const row = await prisma.earning.update({
      where: { id },
      data: {
        source: body.source,
        currency,
        amountCents,
        amountBRLCents:
          body.amount !== undefined || body.currency !== undefined ? Math.round(amountCents * rate) : undefined,
        date: body.date,
        note: body.note,
        opportunityId: body.opportunitySlug !== undefined ? await resolveOpportunityId(body.opportunitySlug) : undefined,
      },
      include: { opportunity: oppSelect },
    });
    return { item: serialize(row) };
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { count } = await prisma.earning.deleteMany({ where: { id, userId: req.user.sub } });
    if (!count) throw notFound('Lançamento');
    return reply.status(204).send();
  });

  /** Painel: total do mês, meta, projeção, série histórica e quebra por fonte. */
  app.get('/summary', async (req) => {
    const { month = currentMonth() } = z.object({ month: monthParam.optional() }).parse(req.query);
    const user = await currentUser(req);
    const premium = isPremium(user);
    assertHistoryAllowed(month, premium);

    const span = premium ? 12 : FREE_LIMITS.earningsHistoryMonths;
    const firstMonth = shiftMonth(month, -(span - 1));
    const rows = await prisma.earning.findMany({
      where: { userId: user.id, date: { gte: monthRange(firstMonth).gte, lt: monthRange(month).lt } },
      include: { opportunity: oppSelect },
    });

    const series = Array.from({ length: span }, (_, i) => ({ month: shiftMonth(firstMonth, i), total: 0 }));
    const idx = new Map(series.map((s, i) => [s.month, i]));
    const bySource = new Map<string, { source: string; total: number; color: string | null; icon: string | null }>();
    let total = 0;
    let count = 0;

    for (const r of rows) {
      const m = r.date.toISOString().slice(0, 7);
      const v = r.amountBRLCents / 100;
      const i = idx.get(m);
      if (i !== undefined) series[i].total += v;
      if (m === month) {
        total += v;
        count++;
        const key = r.opportunity?.title ?? r.source;
        const cur = bySource.get(key) ?? { source: key, total: 0, color: r.opportunity?.color ?? null, icon: r.opportunity?.icon ?? null };
        cur.total += v;
        bySource.set(key, cur);
      }
    }

    const goal = user.monthlyGoalCents / 100;
    const prev = series.length > 1 ? series[series.length - 2].total : 0;

    // Projeção linear só faz sentido para o mês corrente.
    let projection: number | null = null;
    if (month === currentMonth()) {
      const now = new Date(Date.now() - 3 * 3600_000);
      const day = now.getUTCDate();
      const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
      // Nos primeiros dias a extrapolação é ruído (um único pagamento distorce tudo).
      if (day >= 7) projection = Math.round((total / day) * daysInMonth * 100) / 100;
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      month,
      total: round(total),
      entries: count,
      goal,
      goalPct: goal ? Math.round((total / goal) * 100) : 0,
      projection,
      previousMonthTotal: round(prev),
      deltaPct: prev ? Math.round(((total - prev) / prev) * 100) : null,
      series: series.map((s) => ({ ...s, total: round(s.total) })),
      bySource: [...bySource.values()].map((s) => ({ ...s, total: round(s.total) })).sort((a, b) => b.total - a.total),
      historyLimited: !premium,
    };
  });

  /** Exportação CSV (Premium) — útil para o carnê-leão / declaração de IR. */
  app.get('/export.csv', async (req, reply) => {
    const user = await currentUser(req);
    if (!isPremium(user)) throw premiumRequired('Exportação em planilha é um recurso Premium.');
    const rows = await prisma.earning.findMany({
      where: { userId: user.id },
      orderBy: { date: 'asc' },
      include: { opportunity: oppSelect },
    });
    const esc = (s: string) => `"${s.replaceAll('"', '""')}"`;
    const lines = [
      'data;fonte;oportunidade;moeda;valor;valor_brl;observacao',
      ...rows.map((r) =>
        [
          r.date.toISOString().slice(0, 10),
          esc(r.source),
          esc(r.opportunity?.title ?? ''),
          r.currency,
          (r.amountCents / 100).toFixed(2).replace('.', ','),
          (r.amountBRLCents / 100).toFixed(2).replace('.', ','),
          esc(r.note ?? ''),
        ].join(';'),
      ),
    ];
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="ganhos-renda-mais.csv"')
      .send('﻿' + lines.join('\n'));
  });
}
