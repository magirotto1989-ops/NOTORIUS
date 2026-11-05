import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AppError, notFound } from '../lib/errors.js';
import { getUsdBrl } from '../lib/fx.js';
import { isPremium } from '../lib/plan.js';
import { computeMatch, serializePlatform, serializeSummary } from '../lib/opportunity.js';

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().optional(), // pode vir "FREELANCE,ENSINO"
  mode: z.enum(['ONLINE', 'PRESENCIAL', 'HIBRIDO']).optional(),
  region: z.enum(['BR', 'GLOBAL']).optional(),
  currency: z.enum(['BRL', 'USD']).optional(),
  maxStartup: z.coerce.number().int().min(0).optional(),
  fastPay: z.coerce.boolean().optional(),
  eligibleOnly: z.coerce.boolean().optional(),
  sort: z.enum(['match', 'earnings', 'fast', 'popular', 'cheap']).default('match'),
});

export async function opportunityRoutes(app: FastifyInstance) {
  const fx = () => getUsdBrl({ url: app.env.FX_API_URL, fallback: app.env.USD_BRL_FALLBACK, offline: app.env.NODE_ENV === 'test' });

  async function viewer(req: FastifyRequest) {
    await app.optionalAuth(req);
    if (!req.user?.sub) return null;
    return prisma.user.findUnique({ where: { id: req.user.sub }, include: { profile: true } });
  }

  app.get('/', async (req) => {
    const q = listQuery.parse(req.query);
    const [user, usdBrl] = await Promise.all([viewer(req), fx()]);

    const where: Prisma.OpportunityWhereInput = { published: true };
    if (q.category) where.category = { in: q.category.split(',') as never };
    if (q.mode === 'ONLINE') where.mode = { in: ['ONLINE', 'HIBRIDO'] };
    else if (q.mode === 'PRESENCIAL') where.mode = { in: ['PRESENCIAL', 'HIBRIDO'] };
    else if (q.mode) where.mode = q.mode;
    if (q.region) where.region = q.region;
    if (q.currency) where.currency = q.currency;
    if (q.maxStartup !== undefined) where.startupCostBRL = { lte: q.maxStartup };
    if (q.fastPay) where.daysToFirstPay = { lte: 14 };
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { tagline: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
        { platforms: { some: { name: { contains: q.q, mode: 'insensitive' } } } },
      ];
    }

    const rows = await prisma.opportunity.findMany({ where });
    const goal = (user?.monthlyGoalCents ?? 100000) / 100;
    let items = rows.map((o) => {
      const match = computeMatch(o, user?.profile, usdBrl, goal);
      return serializeSummary(o, { usdBrl, match, hours: user?.profile?.hoursPerWeek });
    });

    if (q.eligibleOnly) items = items.filter((i) => i.match?.eligible !== false);

    const avg = (i: (typeof items)[number]) => (i.estMonthlyBRL.min + i.estMonthlyBRL.max) / 2;
    const sorters: Record<typeof q.sort, (a: (typeof items)[number], b: (typeof items)[number]) => number> = {
      match: (a, b) => (b.match?.score ?? b.popularity) - (a.match?.score ?? a.popularity),
      earnings: (a, b) => avg(b) - avg(a),
      fast: (a, b) => a.daysToFirstPay - b.daysToFirstPay,
      popular: (a, b) => b.popularity - a.popularity,
      cheap: (a, b) => a.startupCostBRL - b.startupCostBRL,
    };
    items.sort(sorters[q.sort]);

    return { items, total: items.length, usdBrl, personalized: Boolean(user?.profile) };
  });

  /** Top oportunidades para o perfil do usuário (exige quiz respondido). */
  app.get('/recommended', { onRequest: app.authenticate }, async (req) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) }).parse(req.query);
    const [user, usdBrl] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: req.user.sub }, include: { profile: true } }),
      fx(),
    ]);
    if (!user.profile) throw new AppError(409, 'PROFILE_REQUIRED', 'Responda o quiz para receber recomendações');

    const rows = await prisma.opportunity.findMany({ where: { published: true } });
    const goal = user.monthlyGoalCents / 100;
    const items = rows
      .map((o) => serializeSummary(o, { usdBrl, match: computeMatch(o, user.profile, usdBrl, goal) }))
      .filter((i) => i.match?.eligible)
      .sort((a, b) => b.match!.score - a.match!.score)
      .slice(0, limit);
    return { items, usdBrl };
  });

  app.get('/:slug', async (req) => {
    const { slug } = z.object({ slug: z.string() }).parse(req.params);
    const [user, usdBrl] = await Promise.all([viewer(req), fx()]);
    const o = await prisma.opportunity.findFirst({
      where: { slug, published: true },
      include: { platforms: { orderBy: { order: 'asc' } }, steps: { orderBy: { order: 'asc' } } },
    });
    if (!o) throw notFound('Oportunidade');

    const premium = user ? isPremium(user) : false;
    const goal = (user?.monthlyGoalCents ?? 100000) / 100;
    const match = computeMatch(o, user?.profile, usdBrl, goal);
    const track = user
      ? await prisma.userTrack.findUnique({ where: { userId_opportunityId: { userId: user.id, opportunityId: o.id } } })
      : null;

    return {
      ...serializeSummary(o, { usdBrl, match, hours: user?.profile?.hoursPerWeek }),
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
      platforms: o.platforms.map(serializePlatform),
      steps: o.steps.map((s) => ({ id: s.id, order: s.order, title: s.title, locked: s.premium && !premium })),
      track: track ? { status: track.status, startedAt: track.startedAt } : null,
    };
  });

  /**
   * Registra o clique e devolve o link de destino.
   * Se a plataforma tiver link de afiliado cadastrado, ele é usado (fonte de receita do app).
   */
  app.post('/platforms/:id/click', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await app.optionalAuth(req);
    const platform = await prisma.platform.findUnique({ where: { id } });
    if (!platform) throw notFound('Plataforma');
    const url = platform.affiliateUrl || platform.url;
    await prisma.affiliateClick.create({
      data: { platformId: id, userId: req.user?.sub ?? null, usedAffiliate: Boolean(platform.affiliateUrl) },
    });
    return { url };
  });
}
