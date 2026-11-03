'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconChevronLeft, IconChevronRight, cn } from '@vedere/ui';
import type { PromoMensaje } from '@/lib/tienda/types';

const INTERVALO_MS = 5000;

export function PromoRotator({ mensajes }: { mensajes: PromoMensaje[] }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const varios = mensajes.length > 1;

  useEffect(() => {
    if (!varios || pausa) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % mensajes.length), INTERVALO_MS);
    return () => clearInterval(t);
  }, [varios, pausa, mensajes.length]);

  const actual = mensajes[i] ?? mensajes[0];
  if (!actual) return null;
  const texto = (
    <span className="font-text block truncate text-xs font-medium tracking-wide sm:text-sm">
      {actual.texto}
    </span>
  );

  return (
    <div
      className="bg-negro text-blanco"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      onFocusCapture={() => setPausa(true)}
      onBlurCapture={() => setPausa(false)}
    >
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center gap-1 px-2 sm:px-4">
        {varios && (
          <button
            type="button"
            onClick={() => setI((x) => (x - 1 + mensajes.length) % mensajes.length)}
            aria-label="Promo anterior"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-blanco/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blanco"
          >
            <IconChevronLeft size={16} />
          </button>
        )}
        <div className="min-w-0 flex-1 text-center" aria-live="polite" aria-atomic="true">
          {actual.link ? (
            <Link
              href={actual.link}
              className={cn('block underline-offset-4 hover:underline', 'animate-fade-in')}
              key={actual.id}
            >
              {texto}
            </Link>
          ) : (
            <div key={actual.id} className="animate-fade-in">
              {texto}
            </div>
          )}
        </div>
        {varios && (
          <button
            type="button"
            onClick={() => setI((x) => (x + 1) % mensajes.length)}
            aria-label="Promo siguiente"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-blanco/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blanco"
          >
            <IconChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
