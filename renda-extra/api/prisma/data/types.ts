import type { Category, Currency, Region, WorkMode } from '@prisma/client';

export type SeedStep = { title: string; content: string; premium?: boolean };
export type SeedPlatform = { name: string; url: string; description?: string };

export type SeedOpportunity = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: Category;
  mode: WorkMode;
  region: Region;
  currency: Currency;
  icon: string;
  color: string;
  hourlyMin: number;
  hourlyMax: number;
  earningsNote: string;
  startupCostBRL: number;
  difficulty: number;
  daysToFirstPay: number;
  minHoursWeek: number;
  flexibility: number;
  minEnglish?: number;
  requiredAssets?: string[];
  skills?: string[];
  pros: string[];
  cons: string[];
  warnings?: string[];
  taxNote: string;
  sources?: string[];
  popularity: number;
  platforms: SeedPlatform[];
  steps: SeedStep[];
};

export const ANTI_SCAM = 'Nenhuma plataforma séria cobra taxa para você começar a trabalhar. Desconfie de quem pede pagamento para "liberar" tarefas.';

export const TAX = {
  mei: 'Pode ser formalizado como MEI (CNPJ simples, com INSS e emissão de nota). Confira no Portal do Empreendedor se a sua ocupação é permitida e o limite de faturamento vigente. Sem MEI, declare como rendimento de pessoa física (carnê-leão quando receber de outras pessoas físicas).',
  foreign:
    'Valores recebidos do exterior como pessoa física entram no carnê-leão mensal (Receita Federal). Contas como Payoneer, Wise ou bancos digitais com conta global facilitam o recebimento em dólar.',
  platformPF:
    'Rendimentos de pessoa física acima do limite de isenção devem ser declarados no Imposto de Renda. Guarde comprovantes — o app exporta seu histórico (Premium).',
  app: 'Entregadores e motoristas contribuem ao INSS como contribuintes individuais ou MEI (quando a ocupação permite). A regulamentação do trabalho por aplicativos está em discussão no Congresso — acompanhe as mudanças.',
} as const;
