// Sentry para la API (prompt 6). Con SENTRY_DSN captura los errores 5xx del handler de errores de Fastify y
// los fallos no controlados; sin DSN no hace nada (desarrollo y tests). Importar antes que el resto del app.
import * as Sentry from '@sentry/node';
import type { Env } from '../env.js';

let habilitado = false;

export function iniciarSentry(env: Env): boolean {
  if (!env.SENTRY_DSN || habilitado) return habilitado;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    release: `vedere-api@${env.APP_VERSION}`,
    tracesSampleRate: 0,
  });
  habilitado = true;
  return true;
}

export function sentryHabilitado(): boolean {
  return habilitado;
}

/** Captura un error (sólo si Sentry está iniciado). Devuelve el id del evento o null. */
export function capturarError(err: unknown, contexto: Record<string, unknown> = {}): string | null {
  if (!habilitado) return null;
  return Sentry.captureException(err, { extra: contexto });
}

/** Espera a que salgan los eventos pendientes (apagado del servidor). */
export async function vaciarSentry(): Promise<void> {
  if (!habilitado) return;
  await Sentry.flush(2000).catch(() => undefined);
}
