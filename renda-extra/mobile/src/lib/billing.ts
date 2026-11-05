/**
 * Cobrança — versão web/fallback. No celular, o Metro usa billing.native.ts (RevenueCat).
 * Sem loja disponível, usa a rota de desenvolvimento da API (desligada em produção).
 */
import { api } from './api';
import type { User } from './types';

export type PlanOption = { id: 'monthly' | 'yearly'; priceString: string | null };

export const billing = {
  available: false,
  async init(_userId: string) {},
  async logout() {},
  async options(): Promise<PlanOption[]> {
    return [];
  },
  async purchase(_plan: 'monthly' | 'yearly'): Promise<User> {
    const { user } = await api<{ user: User }>('/billing/dev-activate', { method: 'POST', body: {} });
    return user;
  },
  async restore(): Promise<void> {},
};
