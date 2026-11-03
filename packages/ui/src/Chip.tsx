import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { IconClose } from './icons';

/** Chip de filtro activo con botón para quitarlo. */
export function Chip({
  children,
  onRemove,
  removeLabel,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={removeLabel}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border border-negro/15 bg-blanco pl-3 pr-2 text-sm text-negro transition-colors hover:border-negro',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche',
        className,
      )}
      {...rest}
    >
      <span>{children}</span>
      <IconClose size={16} />
    </button>
  );
}

/** Etiqueta de producto: Nuevo, Edición limitada, Sin stock… */
export function Tag({
  tone = 'negro',
  children,
  className,
}: {
  tone?: 'negro' | 'blanco' | 'sol' | 'vetro' | 'noche' | 'carey';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    negro: 'bg-negro text-blanco',
    blanco: 'bg-blanco text-negro',
    sol: 'bg-sol text-negro',
    vetro: 'bg-vetro text-negro',
    noche: 'bg-noche text-blanco',
    carey: 'bg-carey text-blanco',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
