import crypto from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';
import { prisma } from '../db.js';
import { unauthorized } from './errors.js';
import { isPremium } from './plan.js';

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function issueSession(app: FastifyInstance, user: Pick<User, 'id' | 'role'>) {
  const accessToken = app.jwt.sign({ sub: user.id, role: user.role });
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + app.env.REFRESH_TOKEN_DAYS * 86_400_000),
    },
  });
  return { accessToken, refreshToken };
}

export async function currentUser(req: FastifyRequest) {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) throw unauthorized('Usuário não existe mais');
  return user;
}

export function publicUser(user: User & { profile?: unknown }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: isPremium(user) ? 'PREMIUM' : 'FREE',
    premiumUntil: user.premiumUntil,
    monthlyGoal: user.monthlyGoalCents / 100,
    hasProfile: Boolean(user.profile),
    createdAt: user.createdAt,
  };
}
