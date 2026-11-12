import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';
import type { Env } from './env.js';
import { AppError, unauthorized } from './lib/errors.js';
import { prisma } from './db.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { opportunityRoutes } from './routes/opportunities.js';
import { trackRoutes } from './routes/tracks.js';
import { earningRoutes } from './routes/earnings.js';
import { billingRoutes } from './routes/billing.js';
import { adminRoutes } from './routes/admin.js';
import { metaRoutes } from './routes/meta.js';

type JwtPayload = { sub: string; role: 'USER' | 'ADMIN' };

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (req: FastifyRequest) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function buildApp(env: Env) {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
    trustProxy: true,
  });

  app.decorate('env', env);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(','),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(rateLimit, {
    global: true,
    max: env.NODE_ENV === 'test' ? 10_000 : 300,
    timeWindow: '1 minute',
  });
  await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: env.ACCESS_TOKEN_TTL } });

  await app.register(swagger, {
    openapi: {
      info: { title: 'Renda+ API', version: '1.0.0', description: 'API do app Renda+ — consolidador de renda extra.' },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.decorate('authenticate', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw unauthorized('Sessão expirada ou inválida');
    }
  });

  app.decorate('optionalAuth', async (req: FastifyRequest) => {
    if (!req.headers.authorization) return;
    try {
      await req.jwtVerify();
    } catch {
      /* rota pública: segue anônimo */
    }
  });

  app.decorate('requireAdmin', async (req: FastifyRequest) => {
    await app.authenticate(req, undefined as never);
    if (req.user.role !== 'ADMIN') throw new AppError(403, 'FORBIDDEN', 'Apenas administradores');
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ error: err.code, message: err.message, details: err.details });
    }
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION',
        message: err.issues[0]?.message ?? 'Dados inválidos',
        details: err.flatten().fieldErrors,
      });
    }
    // Registro inexistente (ex.: usuário excluído com token ainda válido)
    if ((err as { code?: string }).code === 'P2025') {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Registro não encontrado' });
    }
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode && e.statusCode < 500) {
      return reply.status(e.statusCode).send({ error: 'REQUEST_ERROR', message: e.message });
    }
    req.log.error(err);
    return reply.status(500).send({ error: 'INTERNAL', message: 'Erro inesperado. Tente novamente.' });
  });

  app.get('/health', { schema: { hide: true } }, async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  });

  await app.register(metaRoutes);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(meRoutes, { prefix: '/me' });
  await app.register(opportunityRoutes, { prefix: '/opportunities' });
  await app.register(trackRoutes, { prefix: '/tracks' });
  await app.register(earningRoutes, { prefix: '/earnings' });
  await app.register(billingRoutes, { prefix: '/billing' });
  await app.register(adminRoutes, { prefix: '/admin' });

  return app;
}
