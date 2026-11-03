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
  // Endpoint S3 alternativo (MinIO, tests). Si falta se usa https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
  R2_ENDPOINT: z.preprocess(emptyToUndefined, z.url().optional()),

  // Mercado Pago (Checkout Pro). Sin MP_ACCESS_TOKEN la integración queda apagada (bandera MP_ENABLED).
  MP_ACCESS_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  MP_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  MP_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // Minutos que se reserva el stock mientras se paga con Mercado Pago.
  RESERVA_STOCK_MINUTOS: z.coerce.number().int().positive().default(30),

  // Google Places / Geocoding (autocompletado y normalización de direcciones). Opcional.
  GOOGLE_MAPS_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),

  // Emails transaccionales (Resend). Sin RESEND_API_KEY los emails se registran como SIMULADO.
  RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().default('Vedere <hola@vedere.com.ar>')),
  // Casilla del equipo para avisos (pedidos sin asignar, solicitudes de cambio).
  ADMIN_NOTIFY_EMAIL: z.preprocess(emptyToUndefined, z.string().optional()),
  // Cada cuántos minutos se revisan los pedidos cuyo plazo de aceptación venció.
  ASIGNACION_INTERVALO_MIN: z.coerce.number().int().positive().default(5),

  // ---- Prompt 6 ----
  // Login con Google (OAuth 2.0, flujo de código). Sin credenciales el botón no se muestra.
  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  // Meta Conversions API (server side): pixel + token de acceso. TEST_EVENT_CODE sólo para el modo debug.
  META_PIXEL_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  META_CAPI_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  META_TEST_EVENT_CODE: z.preprocess(emptyToUndefined, z.string().optional()),
  // GA4 Measurement Protocol (purchase server side, opcional): id de medición y api secret.
  GA4_MEASUREMENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  GA4_API_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  // Sentry (errores de la API). Sin DSN queda apagado.
  SENTRY_DSN: z.preprocess(emptyToUndefined, z.string().optional()),
  SENTRY_ENVIRONMENT: z.preprocess(emptyToUndefined, z.string().optional()),
  // Jobs: carrito abandonado (cada N minutos) y Plan Rivedere (cada N horas). 0 = apagado.
  CARRITO_ABANDONADO_INTERVALO_MIN: z.coerce.number().int().min(0).default(15),
  RIVEDERE_INTERVALO_HORAS: z.coerce.number().int().min(0).default(24),
  // Secreto para disparar jobs a mano (POST /jobs/:nombre con header x-cron-secret), p. ej. desde GitHub Actions.
  CRON_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
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
