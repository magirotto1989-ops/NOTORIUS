import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://renda:renda@localhost:5432/rendamais_test?schema=public',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
      ALLOW_DEV_BILLING: 'true',
      REVENUECAT_WEBHOOK_AUTH: 'Bearer rc-test',
      ADMIN_EMAILS: 'admin@test.dev',
    },
  },
});
