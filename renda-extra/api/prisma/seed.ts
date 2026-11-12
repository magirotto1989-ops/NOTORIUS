import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ONLINE } from './data/online.js';
import { LOCAL } from './data/local.js';

const prisma = new PrismaClient();

/**
 * Seed idempotente: pode rodar a cada deploy.
 * - Oportunidades são atualizadas pelo slug.
 * - Plataformas são casadas pelo nome e NUNCA têm o affiliateUrl sobrescrito (cadastrado pelo admin).
 * - Etapas são casadas pela ordem, preservando o progresso dos usuários.
 */
async function seedOpportunities() {
  const all = [...ONLINE, ...LOCAL];
  for (const o of all) {
    const { platforms, steps, ...data } = o;
    const fields = {
      ...data,
      minEnglish: data.minEnglish ?? 0,
      requiredAssets: data.requiredAssets ?? [],
      skills: data.skills ?? [],
      warnings: data.warnings ?? [],
      sources: data.sources ?? [],
    };
    const { popularity, ...updatable } = fields;
    const opp = await prisma.opportunity.upsert({
      where: { slug: o.slug },
      create: fields,
      update: { ...updatable, reviewedAt: new Date() },
    });

    for (const [i, p] of platforms.entries()) {
      const existing = await prisma.platform.findFirst({ where: { opportunityId: opp.id, name: p.name } });
      if (existing) await prisma.platform.update({ where: { id: existing.id }, data: { url: p.url, description: p.description, caution: p.caution ?? null, order: i } });
      else await prisma.platform.create({ data: { ...p, order: i, opportunityId: opp.id } });
    }
    await prisma.platform.deleteMany({ where: { opportunityId: opp.id, name: { notIn: platforms.map((p) => p.name) } } });

    for (const [i, s] of steps.entries()) {
      await prisma.trackStep.upsert({
        where: { opportunityId_order: { opportunityId: opp.id, order: i + 1 } },
        create: { opportunityId: opp.id, order: i + 1, title: s.title, content: s.content, premium: Boolean(s.premium) },
        update: { title: s.title, content: s.content, premium: Boolean(s.premium) },
      });
    }
    await prisma.trackStep.deleteMany({ where: { opportunityId: opp.id, order: { gt: steps.length } } });
  }
  return all.length;
}

/** Conta demo para QA/apresentação (nunca em produção). */
async function seedDemo() {
  const email = 'demo@rendamais.app';
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: 'Ana Demo', passwordHash: await bcrypt.hash('demo12345', 11), monthlyGoalCents: 150000 },
    update: {},
  });
  await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      hoursPerWeek: 12,
      modePref: 'HIBRIDO',
      capitalBRL: 300,
      skills: ['escrita', 'redes_sociais', 'design'],
      assets: ['computador', 'smartphone', 'moto'],
      englishLevel: 1,
      needsFastCash: true,
      wantsDollar: false,
      experience: 0,
    },
    update: {},
  });
  const hasEarnings = await prisma.earning.count({ where: { userId: user.id } });
  if (!hasEarnings) {
    const opp = (slug: string) => prisma.opportunity.findUniqueOrThrow({ where: { slug } });
    const [red, ent] = await Promise.all([opp('redator-freelancer'), opp('entregador-app')]);
    await prisma.userTrack.createMany({
      data: [
        { userId: user.id, opportunityId: red.id, status: 'EARNING', startedAt: new Date(Date.now() - 70 * 86_400_000) },
        { userId: user.id, opportunityId: ent.id, status: 'EARNING', startedAt: new Date(Date.now() - 40 * 86_400_000) },
      ],
      skipDuplicates: true,
    });
    const now = new Date();
    const rows: { source: string; opportunityId: string; amountCents: number; date: Date }[] = [];
    for (let m = 3; m >= 0; m--) {
      for (let k = 0; k < 4 + (3 - m); k++) {
        const lastDay = m === 0 ? Math.max(now.getUTCDate(), 1) : 28;
        const day = Math.max(1, Math.round(((k + 1) / (4 + (3 - m))) * lastDay));
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, day, 12));
        rows.push({ source: 'Workana', opportunityId: red.id, amountCents: 12000 + k * 3500 + (3 - m) * 2000, date });
        if (m <= 1) rows.push({ source: 'iFood', opportunityId: ent.id, amountCents: 18000 + k * 2500, date });
      }
    }
    await prisma.earning.createMany({ data: rows.map((r) => ({ ...r, userId: user.id, currency: 'BRL', amountBRLCents: r.amountCents })) });
  }
}

const n = await seedOpportunities();
console.log(`✔ ${n} oportunidades sincronizadas`);
if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO !== 'false') {
  await seedDemo();
  console.log('✔ conta demo: demo@rendamais.app / demo12345');
}
await prisma.$disconnect();
