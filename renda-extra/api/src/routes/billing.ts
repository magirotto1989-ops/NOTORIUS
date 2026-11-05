import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AppError, unauthorized } from '../lib/errors.js';
import { publicUser } from '../lib/session.js';

/**
 * Planos exibidos no app. Os preços reais cobrados vêm das lojas (App Store / Google Play)
 * via RevenueCat; estes valores são a vitrine e devem bater com os produtos cadastrados lá.
 */
export const PLANS = {
  entitlement: 'premium',
  monthly: { productId: 'rendamais_premium_monthly', price: 19.9, label: 'Mensal' },
  yearly: { productId: 'rendamais_premium_yearly', price: 149.9, label: 'Anual', badge: 'Economize 37%' },
  trialDays: 7,
  benefits: [
    'Trilhas completas, com scripts, modelos e precificação',
    'Trilhas ativas ilimitadas',
    'Histórico de ganhos ilimitado + gráficos de 12 meses',
    'Exportação em planilha para o Imposto de Renda',
    'Novas oportunidades em primeira mão',
  ],
} as const;

const GRANT = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT']);
const REVOKE = new Set(['EXPIRATION']);

const rcEvent = z.object({
  event: z
    .object({
      id: z.string(),
      type: z.string(),
      app_user_id: z.string(),
      original_app_user_id: z.string().optional(),
      aliases: z.array(z.string()).optional(),
      expiration_at_ms: z.number().nullable().optional(),
      entitlement_ids: z.array(z.string()).nullable().optional(),
    })
    .passthrough(),
});

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export async function billingRoutes(app: FastifyInstance) {
  app.get('/plans', async () => PLANS);

  /**
   * Webhook do RevenueCat. Configure no painel do RevenueCat:
   *   URL: https://SUA-API/billing/revenuecat/webhook
   *   Authorization header: o mesmo valor de REVENUECAT_WEBHOOK_AUTH
   * O app mobile identifica o comprador com Purchases.logIn(user.id).
   */
  app.post('/revenuecat/webhook', async (req, reply) => {
    const expected = app.env.REVENUECAT_WEBHOOK_AUTH;
    if (!expected) throw new AppError(503, 'BILLING_NOT_CONFIGURED', 'Webhook não configurado');
    if (!safeEqual(String(req.headers.authorization ?? ''), expected)) throw unauthorized('Assinatura do webhook inválida');

    const { event } = rcEvent.parse(req.body);

    // Idempotência: RevenueCat reenvia eventos em caso de falha.
    const seen = await prisma.billingEvent.findUnique({ where: { id: event.id } });
    if (seen) return reply.send({ ok: true, duplicate: true });

    const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])].filter(Boolean) as string[];
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: { in: candidates } }, { billingCustomer: { in: candidates } }] },
    });

    const touchesPremium = !event.entitlement_ids || event.entitlement_ids.includes(PLANS.entitlement);
    if (user && touchesPremium) {
      if (GRANT.has(event.type)) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: 'PREMIUM',
            premiumUntil: event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
            billingCustomer: user.billingCustomer ?? event.app_user_id,
          },
        });
      } else if (REVOKE.has(event.type)) {
        await prisma.user.update({ where: { id: user.id }, data: { plan: 'FREE', premiumUntil: null } });
      }
      // CANCELLATION / BILLING_ISSUE: mantém o acesso até expirar (premiumUntil).
    }

    await prisma.billingEvent.create({
      data: { id: event.id, type: event.type, userId: user?.id ?? null, payload: req.body as object },
    });
    return reply.send({ ok: true });
  });

  /** Apenas desenvolvimento/QA: ativa o Premium por 30 dias sem passar pela loja. */
  app.post('/dev-activate', { onRequest: app.authenticate }, async (req) => {
    if (!app.env.ALLOW_DEV_BILLING) throw new AppError(404, 'NOT_FOUND', 'Rota indisponível');
    const { cancel } = z.object({ cancel: z.boolean().optional() }).parse(req.body ?? {});
    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data: cancel ? { plan: 'FREE', premiumUntil: null } : { plan: 'PREMIUM', premiumUntil: new Date(Date.now() + 30 * 86_400_000) },
      include: { profile: true },
    });
    return { user: publicUser(user) };
  });
}
