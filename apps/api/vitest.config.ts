import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Carga ../../.env (si existe) para obtener TEST_DATABASE_URL en desarrollo local.
const rootEnv = path.resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) {
  try {
    process.loadEnvFile(rootEnv);
  } catch {
    /* ignorar */
  }
}

const testDb = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: testDb ? ['test/global-setup.ts'] : [],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDb,
      TEST_DATABASE_URL: testDb,
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Los tests de integración comparten una base: sin paralelismo entre archivos.
    fileParallelism: false,
  },
});
