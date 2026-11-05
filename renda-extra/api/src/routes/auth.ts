import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AppError, unauthorized } from '../lib/errors.js';
import { issueSession, publicUser, sha256 } from '../lib/session.js';

const registerBody = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(80),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres').max(128),
});

const loginBody = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

export async function authRoutes(app: FastifyInstance) {
  const strict = { config: { rateLimit: { max: app.env.NODE_ENV === 'test' ? 1000 : 10, timeWindow: '1 minute' } } };

  app.post('/register', strict, async (req, reply) => {
    const body = registerBody.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) throw new AppError(409, 'EMAIL_IN_USE', 'Este e-mail já tem conta. Faça login.');

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 11),
        role: app.env.ADMIN_EMAILS.includes(body.email) ? 'ADMIN' : 'USER',
      },
      include: { profile: true },
    });
    const tokens = await issueSession(app, user);
    return reply.status(201).send({ user: publicUser(user), ...tokens });
  });

  app.post('/login', strict, async (req) => {
    const body = loginBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email }, include: { profile: true } });
    // Compara mesmo quando o usuário não existe, para não vazar quais e-mails têm conta via tempo de resposta.
    const ok = await bcrypt.compare(body.password, user?.passwordHash ?? '$2b$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    if (!user || !ok) throw unauthorized('E-mail ou senha incorretos');
    return { user: publicUser(user), ...(await issueSession(app, user)) };
  });

  /** Rotação de refresh token: cada uso invalida o anterior. */
  app.post('/refresh', strict, async (req) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) }, include: { user: true } });
    if (!stored || stored.expiresAt < new Date()) throw unauthorized('Sessão expirada');
    if (stored.revokedAt) {
      // Reuso de token já rotacionado = possível roubo. Derruba todas as sessões.
      await prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw unauthorized('Sessão inválida');
    }
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return issueSession(app, stored.user);
  });

  app.post('/logout', async (req, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string().optional() }).parse(req.body ?? {});
    if (refreshToken) {
      await prisma.refreshToken.updateMany({ where: { tokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return reply.status(204).send();
  });
}
