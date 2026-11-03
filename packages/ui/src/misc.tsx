import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/** Botón redondo con ícono; `label` es obligatorio (nombre accesible). */
export function IconButton({
  label,
  className,
  children,
  badge,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  badge?: number;
}) {
  return (
    <button
      type={type}
      aria-label={badge ? `${label} (${badge})` : label}
      className={cn(
        'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-negro transition-colors hover:bg-negro/5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche',
        className,
      )}
      {...rest}
    >
      {children}
      {!!badge && (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-negro px-1 text-[11px] font-semibold text-blanco"
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-xl bg-negro/5', className)}
      {...rest}
    />
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/** Acordeón nativo (<details>) estilizado; accesible con teclado sin JS. */
export function Disclosure({
  summary,
  children,
  defaultOpen,
  className,
  name,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** Mismo name en varios → sólo uno abierto a la vez (acordeón). */
  name?: string;
}) {
  return (
    <details
      className={cn('group border-b border-negro/10', className)}
      open={defaultOpen}
      name={name}
    >
      <summary className="font-text flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-base font-medium text-negro marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-180"
        >
          <path d="M5 9l7 7 7-7" />
        </svg>
      </summary>
      <div className="font-text pb-4 text-base text-negro/85">{children}</div>
    </details>
  );
}

/** Enlace "saltar al contenido" para teclado y lectores de pantalla. */
export function SkipLink({ href = '#contenido' }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-negro focus:px-4 focus:py-2 focus:text-blanco"
    >
      Saltar al contenido
    </a>
  );
}
