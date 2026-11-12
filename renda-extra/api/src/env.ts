import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3333),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),
  CORS_ORIGINS: z.string().default('*'),
  /** Câmbio de fallback caso a cotação online falhe. */
  USD_BRL_FALLBACK: z.coerce.number().default(5.4),
  FX_API_URL: z.string().default('https://economia.awesomeapi.com.br/json/last/USD-BRL'),
  /** Valor do cabeçalho Authorization configurado no webhook do RevenueCat. */
  REVENUECAT_WEBHOOK_AUTH: z.string().optional(),
  /** Libera POST /billing/dev-activate (somente desenvolvimento/QA). */
  ALLOW_DEV_BILLING: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    console.error('❌ Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment');
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.ALLOW_DEV_BILLING) {
    throw new Error('ALLOW_DEV_BILLING não pode ficar ativo em produção');
  }
  return parsed.data;
}
