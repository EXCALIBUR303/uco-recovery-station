import { defineConfig } from '@prisma/config';

// Prisma 7 no longer reads .env automatically, and no longer accepts
// `url = env(...)` inside schema.prisma. Both live here instead.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env present (CI, or env vars already exported) — fall through
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
