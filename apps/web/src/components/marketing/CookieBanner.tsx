'use client';
// Banner de cookies (prompt 6). Hasta que el visitante decide, no se carga ningún script de terceros.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@vedere/ui';
import { guardarConsentimiento, leerConsentimiento } from './consentimiento';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (leerConsentimiento() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  function decidir(valor: 'todas' | 'necesarias') {
    guardarConsentimiento(valor);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Uso de cookies"
      data-testid="cookie-banner"
      className="font-text fixed inset-x-3 bottom-3 z-40 mx-auto max-w-2xl rounded-3xl border border-negro/10 bg-blanco p-5 shadow-2xl md:inset-x-6 md:bottom-6 md:p-6 [bottom:max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <p className="text-sm leading-relaxed text-negro/85">
        Usamos cookies propias para que la tienda funcione (carrito, sesión) y, si nos dejás, cookies de
        analítica y publicidad (Google Analytics y Meta) para entender qué funciona y medir campañas. Podés
        cambiarlo cuando quieras en{' '}
        <Link href="/legal/cookies" className="underline underline-offset-4">
          Cookies
        </Link>
        .
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="md" onClick={() => decidir('necesarias')} data-testid="cookies-necesarias">
          Sólo necesarias
        </Button>
        <Button size="md" onClick={() => decidir('todas')} data-testid="cookies-aceptar">
          Aceptar todas
        </Button>
      </div>
    </div>
  );
}

/** Selector para la página /legal/cookies: muestra y cambia la preferencia guardada. */
export function CookiePreferencias() {
  const [valor, setValor] = useState<'todas' | 'necesarias' | null | 'cargando'>('cargando');

  useEffect(() => {
    setValor(leerConsentimiento());
  }, []);

  function elegir(v: 'todas' | 'necesarias') {
    guardarConsentimiento(v);
    setValor(v);
  }

  return (
    <div className="font-text rounded-3xl bg-gris-claro p-5">
      <p className="text-sm text-gris-texto">Tu preferencia actual</p>
      <p className="mt-1 text-lg font-semibold" aria-live="polite">
        {valor === 'cargando'
          ? '…'
          : valor === 'todas'
            ? 'Todas las cookies (analítica y publicidad activas)'
            : valor === 'necesarias'
              ? 'Sólo las necesarias'
              : 'Todavía no elegiste'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="md" onClick={() => elegir('todas')} disabled={valor === 'todas'}>
          Aceptar todas
        </Button>
        <Button variant="secondary" size="md" onClick={() => elegir('necesarias')} disabled={valor === 'necesarias'}>
          Sólo necesarias
        </Button>
      </div>
      <p className="mt-3 text-xs text-gris-texto">
        Si pasás de &ldquo;todas&rdquo; a &ldquo;sólo necesarias&rdquo;, los scripts ya cargados dejan de usarse al
        recargar la página.
      </p>
    </div>
  );
}
