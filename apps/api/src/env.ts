// Validación de variables de entorno con Zod. La API no arranca si falta algo crítico.
import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  APP_VERSION: z.string().default('0.2.0'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),

  // Único origen permitido por CORS (la web).
  WEB_URL: z.url({ error: 'WEB_URL debe ser una URL válida' }),
  // URL pública de esta API (para armar URLs de imágenes en modo local).
  API_PUBLIC_URL: z.preprocess(emptyToUndefined, z.url().default('http://localhost:4000')),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  ACCESS_TOKEN_TTL: z
    .string()
    .regex(/^\d+(s|m|h|d)$/, 'ACCESS_TOKEN_TTL con formato 15m, 1h, etc.')
    .default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  COOKIE_DOMAIN: z.preprocess(emptyToUndefined, z.string().optional()),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),

  // Almacenamiento de imágenes: "r2" (Cloudflare) o "local" (disco; sólo desarrollo). Auto: r2 si hay credenciales.
  STORAGE_DRIVER: z.preprocess(emptyToUndefined, z.enum(['r2', 'local', 'auto']).default('auto')),
  UPLOADS_DIR: z.preprocess(emptyToUndefined, z.string().default('./uploads')),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),

  // Cloudflare R2 (compatible S3). Opcionales hasta que se configure el bucket.
  R2_ACCOUNT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_BUCKET: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_PUBLIC_URL: z.preprocess(emptyToUndefined, z.url().optional()),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(overrides: Record<string, string | undefined> = {}): Env {
  const result = envSchema.safeParse({ ...process.env, ...overrides });
  if (!result.success) {
    const detalle = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${detalle}`);
  }
  return result.data;
}

/** Convierte "15m" / "2h" / "7d" / "30s" a segundos. */
export function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(ttl);
  if (!match) throw new Error(`TTL inválido: ${ttl}`);
  const n = Number(match[1]);
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return n * mult;
}
