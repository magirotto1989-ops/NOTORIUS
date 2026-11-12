import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { FREE_LIMITS } from '../domain/meta.js';
import { notFound, premiumRequired } from '../lib/errors.js';
import { isPremium } from '../lib/plan.js';
import { currentUser } from '../lib/session.js';

const ACTIVE = ['IN_PROGRESS', 'EARNING'] as const;

export async function trackRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  async function findOpportunity(slug: string) {
    const o = await prisma.opportunity.findFirst({ where: { slug, published: true } });
    if (!o) throw notFound('Oportunidade');
    return o;
  }

  /** Minhas trilhas, com progresso. */
  app.get('/', async (req) => {
    const userId = req.user.sub;
    const tracks = await prisma.userTrack.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { opportunity: { include: { steps: { select: { id: true } } } } },
    });
    const done = await prisma.stepProgress.findMany({ where: { userId }, select: { stepId: true } });
    const doneSet = new Set(done.map((d) => d.stepId));

    return {
      items: tracks.map((t) => {
        const total = t.opportunity.steps.length;
        const completed = t.opportunity.steps.filter((s) => doneSet.has(s.id)).length;
        return {
          slug: t.opportunity.slug,
          title: t.opportunity.title,
          icon: t.opportunity.icon,
          color: t.opportunity.color,
          category: t.opportunity.category,
          status: t.status,
          startedAt: t.startedAt,
          progress: { completed, total, pct: total ? Math.round((completed / total) * 100) : 0 },
        };
      }),
    };
  });

  /** Salva / inicia / atualiza status de uma trilha. */
  app.put('/:slug', async (req) => {
    const { slug } = z.object({ slug: z.string() }).parse(req.params);
    const { status } = z.object({ status: z.enum(['SAVED', 'IN_PROGRESS', 'EARNING', 'PAUSED']) }).parse(req.body);
    const [user, o] = await Promise.all([currentUser(req), findOpportunity(slug)]);
    const existing = await prisma.userTrack.findUnique({ where: { userId_opportunityId: { userId: user.id, opportunityId: o.id } } });

    const becomingActive = (ACTIVE as readonly string[]).includes(status) && !(ACTIVE as readonly string[]).includes(existing?.status ?? '');
    if (becomingActive && !isPremium(user)) {
      const active = await prisma.userTrack.count({ where: { userId: user.id, status: { in: [...ACTIVE] } } });
      if (active >= FREE_LIMITS.activeTracks) {
        throw premiumRequired(`No plano grátis você pode ter até ${FREE_LIMITS.activeTracks} trilhas ativas. Pause uma ou assine o Premium.`);
      }
    }

    const startedAt = existing?.startedAt ?? ((ACTIVE as readonly string[]).includes(status) ? new Date() : null);
    const track = await prisma.userTrack.upsert({
      where: { userId_opportunityId: { userId: user.id, opportunityId: o.id } },
      create: { userId: user.id, opportunityId: o.id, status, startedAt },
      update: { status, startedAt },
    });
    if (status !== 'SAVED') await prisma.opportunity.update({ where: { id: o.id }, data: { popularity: { increment: existing ? 0 : 1 } } });
    return { track: { status: track.status, startedAt: track.startedAt } };
  });

  app.delete('/:slug', async (req, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(req.params);
    const o = await findOpportunity(slug);
    await prisma.userTrack.deleteMany({ where: { userId: req.user.sub, opportunityId: o.id } });
    return reply.status(204).send();
  });

  /** Passo a passo completo (conteúdo premium bloqueado no plano grátis). */
  app.get('/:slug', async (req) => {
    const { slug } = z.object({ slug: z.string() }).parse(req.params);
    const user = await currentUser(req);
    const o = await prisma.opportunity.findFirst({
      where: { slug, published: true },
      include: { steps: { orderBy: { order: 'asc' } }, platforms: { orderBy: { order: 'asc' } } },
    });
    if (!o) throw notFound('Oportunidade');
    const premium = isPremium(user);
    const [track, done] = await Promise.all([
      prisma.userTrack.findUnique({ where: { userId_opportunityId: { userId: user.id, opportunityId: o.id } } }),
      prisma.stepProgress.findMany({ where: { userId: user.id, stepId: { in: o.steps.map((s) => s.id) } } }),
    ]);
    const doneMap = new Map(done.map((d) => [d.stepId, d.doneAt]));
    const completed = o.steps.filter((s) => doneMap.has(s.id)).length;

    return {
      slug: o.slug,
      title: o.title,
      icon: o.icon,
      color: o.color,
      track: track ? { status: track.status, startedAt: track.startedAt } : null,
      progress: { completed, total: o.steps.length, pct: o.steps.length ? Math.round((completed / o.steps.length) * 100) : 0 },
      platforms: o.platforms.map((p) => ({ id: p.id, name: p.name, caution: p.caution })),
      steps: o.steps.map((s) => {
        const locked = s.premium && !premium;
        return {
          id: s.id,
          order: s.order,
          title: s.title,
          content: locked ? null : s.content,
          locked,
          done: doneMap.has(s.id),
          doneAt: doneMap.get(s.id) ?? null,
        };
      }),
    };
  });

  app.post('/:slug/steps/:stepId', async (req) => {
    const { slug, stepId } = z.object({ slug: z.string(), stepId: z.string() }).parse(req.params);
    const { done } = z.object({ done: z.boolean() }).parse(req.body);
    const user = await currentUser(req);
    const step = await prisma.trackStep.findFirst({ where: { id: stepId, opportunity: { slug } } });
    if (!step) throw notFound('Etapa');
    if (step.premium && !isPremium(user)) throw premiumRequired('Esta etapa faz parte do conteúdo Premium.');

    if (done) {
      await prisma.stepProgress.upsert({
        where: { userId_stepId: { userId: user.id, stepId } },
        create: { userId: user.id, stepId },
        update: {},
      });
      // Marcar uma etapa já coloca a trilha como "em andamento" (se couber no plano).
      const track = await prisma.userTrack.findUnique({
        where: { userId_opportunityId: { userId: user.id, opportunityId: step.opportunityId } },
      });
      if (!track) {
        await prisma.userTrack.create({
          data: { userId: user.id, opportunityId: step.opportunityId, status: 'SAVED' },
        });
      }
    } else {
      await prisma.stepProgress.deleteMany({ where: { userId: user.id, stepId } });
    }
    return { ok: true, done };
  });
}
