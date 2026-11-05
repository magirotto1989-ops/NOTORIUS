import { execSync } from 'node:child_process';

const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://renda:renda@localhost:5432/rendamais_test?schema=public';

export default async function setup() {
  // Proteção: só limpa bancos explicitamente de teste.
  if (!/_test(\?|$)/.test(new URL(TEST_DB).pathname + (new URL(TEST_DB).search ? '?' : ''))) {
    throw new Error('TEST_DATABASE_URL precisa apontar para um banco com sufixo _test');
  }
  const env = { ...process.env, NODE_ENV: 'test', SEED_DEMO: 'false', DATABASE_URL: TEST_DB };
  execSync('npx prisma migrate deploy', { env, stdio: 'inherit' });

  process.env.DATABASE_URL = TEST_DB;
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasourceUrl: TEST_DB });
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
  }
  await prisma.$disconnect();

  execSync('npx tsx prisma/seed.ts', { env, stdio: 'inherit' });
}
