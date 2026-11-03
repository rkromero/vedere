'use client';
// Contenedor de un paso del checkout: número, título, resumen cuando está completo y botón "Editar".
import type { ReactNode } from 'react';
import { IconCheck, cn } from '@vedere/ui';

export type EstadoPaso = 'pendiente' | 'activo' | 'completo';

export function Paso({
  numero,
  titulo,
  estado,
  resumen,
  onEditar,
  children,
}: {
  numero: number;
  titulo: string;
  estado: EstadoPaso;
  /** Lo que se muestra cuando el paso ya está completo y colapsado. */
  resumen?: ReactNode;
  onEditar?: () => void;
  children: ReactNode;
}) {
  const id = `paso-${numero}`;
  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className={cn(
        'font-text rounded-2xl border bg-blanco transition-colors',
        estado === 'activo' ? 'border-negro' : 'border-negro/10',
        estado === 'pendiente' && 'opacity-60',
      )}
    >
      <header className="flex items-center gap-3 px-5 py-4">
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            estado === 'completo' ? 'bg-vetro text-negro' : estado === 'activo' ? 'bg-negro text-blanco' : 'bg-gris-claro text-gris-texto',
          )}
        >
          {estado === 'completo' ? <IconCheck size={16} /> : numero}
        </span>
        <h2 id={`${id}-titulo`} className="flex-1 text-lg font-semibold">
          <span className="sr-only">Paso {numero}: </span>
          {titulo}
        </h2>
        {estado === 'completo' && onEditar && (
          <button
            type="button"
            onClick={onEditar}
            className="min-h-10 px-2 text-sm underline underline-offset-4"
            aria-label={`Editar ${titulo.toLowerCase()}`}
          >
            Editar
          </button>
        )}
      </header>
      {estado === 'completo' && resumen && (
        <div className="px-5 pb-5 text-sm text-negro/80">{resumen}</div>
      )}
      {estado === 'activo' && <div className="px-5 pb-6">{children}</div>}
    </section>
  );
}
