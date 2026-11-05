import type { FastifyInstance } from 'fastify';
import { ASSETS, CATEGORIES, ENGLISH_LEVELS, EXPERIENCE_LEVELS, FREE_LIMITS, MODES, SKILLS } from '../domain/meta.js';
import { getUsdBrl } from '../lib/fx.js';
import { PLANS } from './billing.js';

export async function metaRoutes(app: FastifyInstance) {
  app.get('/meta', async () => ({
    skills: SKILLS,
    assets: ASSETS,
    categories: CATEGORIES,
    modes: MODES,
    englishLevels: ENGLISH_LEVELS,
    experienceLevels: EXPERIENCE_LEVELS,
    freeLimits: FREE_LIMITS,
    plans: PLANS,
    usdBrl: await getUsdBrl({
      url: app.env.FX_API_URL,
      fallback: app.env.USD_BRL_FALLBACK,
      offline: app.env.NODE_ENV === 'test',
    }),
    disclaimer:
      'Os valores são estimativas baseadas em fontes públicas e relatos de mercado. Ganhos reais variam conforme cidade, dedicação, demanda e regras de cada plataforma. Não há promessa de renda.',
  }));
}
