import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ASSET_KEYS, SKILL_KEYS } from '../domain/meta.js';
import { unauthorized } from '../lib/errors.js';
import { currentUser, publicUser } from '../lib/session.js';

const profileBody = z.object({
  hoursPerWeek: z.number().int().min(1).max(80),
  modePref: z.enum(['ONLINE', 'PRESENCIAL', 'HIBRIDO']),
  capitalBRL: z.number().int().min(0).max(1_000_000),
  skills: z.array(z.enum(SKILL_KEYS as [string, ...string[]])).max(30),
  assets: z.array(z.enum(ASSET_KEYS as [string, ...string[]])).max(30),
  englishLevel: z.number().int().min(0).max(3),
  needsFastCash: z.boolean(),
  wantsDollar: z.boolean(),
  experience: z.number().int().min(0).max(2),
  city: z.string().trim().max(80).optional(),
  monthlyGoal: z.number().min(50).max(1_000_000).optional(),
});

export async function meRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/', async (req) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, include: { profile: true } });
    if (!user) throw unauthorized('Usuário não existe mais');
    return { user: publicUser(user), profile: user.profile };
  });

  app.patch('/', async (req) => {
    const body = z
      .object({ name: z.string().trim().min(2).max(80).optional(), monthlyGoal: z.number().min(50).max(1_000_000).optional() })
      .parse(req.body);
    await currentUser(req);
    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data: {
        name: body.name,
        monthlyGoalCents: body.monthlyGoal !== undefined ? Math.round(body.monthlyGoal * 100) : undefined,
      },
      include: { profile: true },
    });
    return { user: publicUser(user) };
  });

  /** Salva as respostas do quiz. */
  app.put('/profile', async (req) => {
    const { monthlyGoal, ...data } = profileBody.parse(req.body);
    await currentUser(req);
    const profile = await prisma.profile.upsert({
      where: { userId: req.user.sub },
      create: { ...data, userId: req.user.sub },
      update: data,
    });
    if (monthlyGoal !== undefined) {
      await prisma.user.update({ where: { id: req.user.sub }, data: { monthlyGoalCents: Math.round(monthlyGoal * 100) } });
    }
    return { profile };
  });

  /** LGPD: portabilidade — exporta todos os dados do titular. */
  app.get('/export', async (req) => {
    await currentUser(req);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.sub },
      include: { profile: true, tracks: true, stepProgress: true, earnings: true },
    });
    const { passwordHash: _omit, ...rest } = user;
    return rest;
  });

  /** LGPD + exigência das lojas: exclusão de conta pelo próprio app. */
  app.delete('/', async (req, reply) => {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
    const user = await currentUser(req);
    if (!(await bcrypt.compare(password, user.passwordHash))) throw unauthorized('Senha incorreta');
    await prisma.user.delete({ where: { id: user.id } });
    return reply.status(204).send();
  });
}
