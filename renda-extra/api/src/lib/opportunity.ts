import type { Opportunity, Platform, Profile } from '@prisma/client';
import { estimateMonthlyBRL, hourlyInBRL, matchOpportunity, type MatchResult } from '../domain/match.js';

export const DEFAULT_HOURS = 10;

export function toMatchProfile(p: Profile) {
  return {
    hoursPerWeek: p.hoursPerWeek,
    modePref: p.modePref,
    capitalBRL: p.capitalBRL,
    skills: p.skills,
    assets: p.assets,
    englishLevel: p.englishLevel,
    needsFastCash: p.needsFastCash,
    wantsDollar: p.wantsDollar,
    experience: p.experience,
  };
}

export function computeMatch(o: Opportunity, profile: Profile | null | undefined, usdBrl: number, goalBRL: number): MatchResult | null {
  if (!profile) return null;
  return matchOpportunity(toMatchProfile(profile), o, { usdBrl, goalBRL });
}

export function serializeSummary(o: Opportunity, ctx: { usdBrl: number; match: MatchResult | null; hours?: number }) {
  const hourly = hourlyInBRL(o, ctx.usdBrl);
  const est = ctx.match?.estMonthlyBRL ?? estimateMonthlyBRL(o, ctx.hours ?? DEFAULT_HOURS, ctx.usdBrl);
  return {
    id: o.id,
    slug: o.slug,
    title: o.title,
    tagline: o.tagline,
    category: o.category,
    mode: o.mode,
    region: o.region,
    currency: o.currency,
    icon: o.icon,
    color: o.color,
    hourly: { min: o.hourlyMin, max: o.hourlyMax, currency: o.currency },
    hourlyBRL: { min: Math.round(hourly.min), max: Math.round(hourly.max) },
    estMonthlyBRL: est,
    startupCostBRL: o.startupCostBRL,
    difficulty: o.difficulty,
    daysToFirstPay: o.daysToFirstPay,
    flexibility: o.flexibility,
    popularity: o.popularity,
    match: ctx.match
      ? { score: ctx.match.score, eligible: ctx.match.eligible, reasons: ctx.match.reasons, blockers: ctx.match.blockers }
      : null,
  };
}

export function serializePlatform(p: Platform) {
  return { id: p.id, name: p.name, description: p.description, host: safeHost(p.url) };
}

function safeHost(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}
