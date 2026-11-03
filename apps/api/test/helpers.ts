import { vi } from 'vitest';
import type { Env } from '../src/env.js';
import { loadEnv } from '../src/env.js';

// Mock de @vedere/db: los tests no tocan una base real.
export const dbMock = {
  checkDatabase: vi.fn(async () => ({ ok: true, latencyMs: 1 })),
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $queryRaw: vi.fn(),
    $disconnect: vi.fn(),
  },
};

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    WEB_URL: 'http://localhost:3000',
    JWT_ACCESS_SECRET: 'test-access-secret-con-mas-de-32-caracteres!!',
    JWT_REFRESH_SECRET: 'test-refresh-secret-con-mas-de-32-caracteres!!',
    RATE_LIMIT_MAX: '1000',
    RATE_LIMIT_AUTH_MAX: '1000',
    ...overrides,
  });
}
