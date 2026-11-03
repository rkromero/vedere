// Sentry en el servidor de Next (prompt 6). Con NEXT_PUBLIC_SENTRY_DSN captura errores de server components,
// route handlers y middleware; sin DSN no hace nada.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}

export const onRequestError = Sentry.captureRequestError;
