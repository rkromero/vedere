// Cliente Prisma compartido (singleton) + re-export de tipos.
import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';
export * from './prompt6.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : process.env.NODE_ENV === 'test'
          ? []
          : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export interface DatabaseStatus {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

/** Chequeo liviano de conectividad para /health. */
export async function checkDatabase(): Promise<DatabaseStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}
