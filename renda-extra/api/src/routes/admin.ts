import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { notFound } from '../lib/errors.js';

/** Painel administrativo (via API / Swagger em /docs). Usuários em ADMIN_EMAILS viram ADMIN no cadastro. */
export async function adminRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.requireAdmin);

  app.get('/stats', async () => {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [users, premium, withProfile, clicks, earningsAgg, topTracks] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { plan: 'PREMIUM', OR: [{ premiumUntil: null }, { premiumUntil: { gt: new Date() } }] } }),
      prisma.profile.count(),
      prisma.affiliateClick.groupBy({ by: ['platformId', 'usedAffiliate'], where: { createdAt: { gte: since } }, _count: true }),
      prisma.earning.aggregate({ _sum: { amountBRLCents: true }, _count: true }),
      prisma.userTrack.groupBy({ by: ['opportunityId'], _count: true, orderBy: { _count: { opportunityId: 'desc' } }, take: 10 }),
    ]);
    const platforms = await prisma.platform.findMany({ where: { id: { in: clicks.map((c) => c.platformId) } }, select: { id: true, name: true } });
    const names = new Map(platforms.map((p) => [p.id, p.name]));
    const opps = await prisma.opportunity.findMany({ where: { id: { in: topTracks.map((t) => t.opportunityId) } }, select: { id: true, title: true } });
    const titles = new Map(opps.map((o) => [o.id, o.title]));

    return {
      users,
      premium,
      conversionPct: users ? Math.round((premium / users) * 1000) / 10 : 0,
      quizCompletionPct: users ? Math.round((withProfile / users) * 1000) / 10 : 0,
      clicksLast30d: clicks
        .map((c) => ({ platform: names.get(c.platformId) ?? c.platformId, affiliate: c.usedAffiliate, clicks: c._count }))
        .sort((a, b) => b.clicks - a.clicks),
      earningsTrackedBRL: (earningsAgg._sum.amountBRLCents ?? 0) / 100,
      earningsEntries: earningsAgg._count,
      topTracks: topTracks.map((t) => ({ opportunity: titles.get(t.opportunityId), users: t._count })),
    };
  });

  app.get('/platforms', async () =>
    prisma.platform.findMany({ orderBy: [{ opportunity: { title: 'asc' } }, { order: 'asc' }], include: { opportunity: { select: { slug: true } } } }),
  );

  /** Cadastre aqui seus links de afiliado/indicação. */
  app.patch('/platforms/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({ url: z.string().url().optional(), affiliateUrl: z.string().url().nullable().optional(), description: z.string().max(200).optional() })
      .parse(req.body);
    const exists = await prisma.platform.findUnique({ where: { id } });
    if (!exists) throw notFound('Plataforma');
    return prisma.platform.update({ where: { id }, data: body });
  });

  app.patch('/opportunities/:slug', async (req) => {
    const { slug } = z.object({ slug: z.string() }).parse(req.params);
    const body = z
      .object({
        published: z.boolean().optional(),
        hourlyMin: z.number().min(0).optional(),
        hourlyMax: z.number().min(0).optional(),
        earningsNote: z.string().optional(),
        warnings: z.array(z.string()).optional(),
      })
      .parse(req.body);
    const exists = await prisma.opportunity.findUnique({ where: { slug } });
    if (!exists) throw notFound('Oportunidade');
    return prisma.opportunity.update({ where: { slug }, data: { ...body, reviewedAt: new Date() } });
  });
}
