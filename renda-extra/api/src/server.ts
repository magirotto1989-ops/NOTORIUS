import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { prisma } from './db.js';

const env = loadEnv();
const app = await buildApp(env);

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: env.PORT, host: env.HOST });
