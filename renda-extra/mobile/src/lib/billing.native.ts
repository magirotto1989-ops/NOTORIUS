/**
 * Cobrança nativa via RevenueCat (App Store / Google Play).
 * O RevenueCat avisa a API pelo webhook /billing/revenuecat/webhook, que libera o Premium.
 * Requer development build (não funciona no Expo Go) e as chaves EXPO_PUBLIC_REVENUECAT_*.
 */
import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { api } from './api';
import type { User } from './types';

export type PlanOption = { id: 'monthly' | 'yearly'; priceString: string | null };

const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

let configured = false;
const packages: Partial<Record<'monthly' | 'yearly', PurchasesPackage>> = {};

async function me() {
  // O webhook pode levar alguns segundos: tenta algumas vezes.
  for (let i = 0; i < 5; i++) {
    const { user } = await api<{ user: User }>('/me');
    if (user.plan === 'PREMIUM') return user;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return (await api<{ user: User }>('/me')).user;
}

export const billing = {
  get available() {
    return Boolean(KEY);
  },
  async init(userId: string) {
    if (!KEY) return;
    if (!configured) {
      Purchases.configure({ apiKey: KEY, appUserID: userId });
      configured = true;
    } else {
      await Purchases.logIn(userId);
    }
  },
  async logout() {
    if (configured) await Purchases.logOut().catch(() => {});
  },
  async options(): Promise<PlanOption[]> {
    if (!KEY || !configured) return [];
    const offerings = await Purchases.getOfferings();
    const cur = offerings.current;
    if (cur?.monthly) packages.monthly = cur.monthly;
    if (cur?.annual) packages.yearly = cur.annual;
    return (['monthly', 'yearly'] as const).map((id) => ({ id, priceString: packages[id]?.product.priceString ?? null }));
  },
  async purchase(plan: 'monthly' | 'yearly'): Promise<User> {
    if (!KEY) {
      const { user } = await api<{ user: User }>('/billing/dev-activate', { method: 'POST', body: {} });
      return user;
    }
    if (!packages[plan]) await billing.options();
    const pkg = packages[plan];
    if (!pkg) throw new Error('Plano indisponível no momento. Tente novamente.');
    await Purchases.purchasePackage(pkg);
    return me();
  },
  async restore() {
    if (KEY && configured) await Purchases.restorePurchases();
  },
};
