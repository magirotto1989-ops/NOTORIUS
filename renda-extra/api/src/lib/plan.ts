import type { User } from '@prisma/client';

/** Premium vale enquanto premiumUntil estiver no futuro (ou nulo + plano PREMIUM = vitalício/manual). */
export function isPremium(user: Pick<User, 'plan' | 'premiumUntil'>, now = new Date()) {
  if (user.plan !== 'PREMIUM') return false;
  return !user.premiumUntil || user.premiumUntil > now;
}
