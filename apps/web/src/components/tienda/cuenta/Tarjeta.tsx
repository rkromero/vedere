// Bloques de Mi cuenta: tarjeta con título y acción, estado vacío y pastilla de estado.
import type { ReactNode } from 'react';
import { cn } from '@vedere/ui';

export function Tarjeta({
  titulo,
  accion,
  children,
  className,
}: {
  titulo?: ReactNode;
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-3xl border border-negro/10 p-5 md:p-6', className)}>
      {(titulo || accion) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-lg font-semibold">{titulo}</h2>}
          {accion}
        </header>
      )}
      {children}
    </section>
  );
}

export function SinDatos({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-gris-claro px-4 py-6 text-center text-sm text-gris-texto">{children}</p>;
}

export function Pastilla({
  children,
  tone = 'neutral',
  className,
  ...rest
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info';
  className?: string;
  'data-testid'?: string;
}) {
  const tones = {
    neutral: 'bg-gris-claro text-negro',
    ok: 'bg-vetro/40 text-negro',
    warn: 'bg-sol/40 text-negro',
    danger: 'bg-carey/15 text-carey',
    info: 'bg-noche/10 text-noche',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-sm font-medium', tones[tone], className)} {...rest}>
      {children}
    </span>
  );
}
