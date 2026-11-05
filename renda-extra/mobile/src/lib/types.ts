export type Mode = 'ONLINE' | 'PRESENCIAL' | 'HIBRIDO';
export type Currency = 'BRL' | 'USD';
export type TrackStatus = 'SAVED' | 'IN_PROGRESS' | 'EARNING' | 'PAUSED';

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PREMIUM';
  premiumUntil: string | null;
  monthlyGoal: number;
  hasProfile: boolean;
};

export type Profile = {
  hoursPerWeek: number;
  modePref: Mode;
  capitalBRL: number;
  skills: string[];
  assets: string[];
  englishLevel: number;
  needsFastCash: boolean;
  wantsDollar: boolean;
  experience: number;
  city?: string | null;
};

export type Match = { score: number; eligible: boolean; reasons: string[]; blockers: string[] };

export type OpportunitySummary = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  category: string;
  mode: Mode;
  region: 'BR' | 'GLOBAL';
  currency: Currency;
  icon: string;
  color: string;
  hourly: { min: number; max: number; currency: Currency };
  hourlyBRL: { min: number; max: number };
  estMonthlyBRL: { min: number; max: number };
  startupCostBRL: number;
  difficulty: number;
  daysToFirstPay: number;
  flexibility: number;
  popularity: number;
  match: Match | null;
};

export type OpportunityDetail = OpportunitySummary & {
  description: string;
  earningsNote: string;
  requiredAssets: string[];
  skills: string[];
  minEnglish: number;
  minHoursWeek: number;
  pros: string[];
  cons: string[];
  warnings: string[];
  taxNote: string;
  sources: string[];
  reviewedAt: string;
  platforms: { id: string; name: string; description: string | null; host: string }[];
  steps: { id: string; order: number; title: string; locked: boolean }[];
  track: { status: TrackStatus; startedAt: string | null } | null;
};

export type TrackListItem = {
  slug: string;
  title: string;
  icon: string;
  color: string;
  category: string;
  status: TrackStatus;
  startedAt: string | null;
  progress: { completed: number; total: number; pct: number };
};

export type TrackDetail = {
  slug: string;
  title: string;
  icon: string;
  color: string;
  track: { status: TrackStatus; startedAt: string | null } | null;
  progress: { completed: number; total: number; pct: number };
  platforms: { id: string; name: string }[];
  steps: { id: string; order: number; title: string; content: string | null; locked: boolean; done: boolean }[];
};

export type Earning = {
  id: string;
  source: string;
  amount: number;
  currency: Currency;
  amountBRL: number;
  date: string;
  note: string | null;
  opportunity: { slug: string; title: string; icon: string; color: string } | null;
};

export type EarningsSummary = {
  month: string;
  total: number;
  entries: number;
  goal: number;
  goalPct: number;
  projection: number | null;
  previousMonthTotal: number;
  deltaPct: number | null;
  series: { month: string; total: number }[];
  bySource: { source: string; total: number; color: string | null; icon: string | null }[];
  historyLimited: boolean;
};

type Labeled = { label: string; icon: string };
export type Meta = {
  skills: Record<string, Labeled>;
  assets: Record<string, Labeled>;
  categories: Record<string, Labeled>;
  modes: Record<Mode, Labeled>;
  englishLevels: string[];
  experienceLevels: string[];
  freeLimits: { activeTracks: number; earningsHistoryMonths: number };
  plans: {
    entitlement: string;
    monthly: { productId: string; price: number; label: string };
    yearly: { productId: string; price: number; label: string; badge?: string };
    trialDays: number;
    benefits: string[];
  };
  usdBrl: number;
  disclaimer: string;
};
