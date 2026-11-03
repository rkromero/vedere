'use client';
// Último recurso cuando falla el layout raíz: reporta a Sentry y ofrece reintentar.
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="es-AR">
      <body style={{ fontFamily: 'Arial, sans-serif', padding: 40, maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Algo salió mal</h1>
        <p style={{ color: '#555', marginBottom: 20 }}>
          Ya registramos el error. Probá de nuevo o volvé más tarde.
          {error.digest ? ` (ref. ${error.digest})` : ''}
        </p>
        <button
          onClick={reset}
          style={{ background: '#0A0A0A', color: '#fff', border: 0, padding: '10px 18px', borderRadius: 8, cursor: 'pointer' }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
