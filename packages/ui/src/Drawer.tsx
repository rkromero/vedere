'use client';
// Panel lateral / modal accesible sobre <dialog> nativo: foco atrapado, Esc cierra, scroll del
// fondo bloqueado y foco devuelto al disparador al cerrar.
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from './cn';
import { IconClose } from './icons';

export type DrawerSide = 'right' | 'left' | 'bottom' | 'center';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Oculta visualmente el título (sigue siendo el nombre accesible). */
  hideTitle?: boolean;
  side?: DrawerSide;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Contenido extra en la cabecera (ej. contador). */
  headerExtra?: ReactNode;
  /** id para enlazar el botón de cierre con tests o analítica. */
  closeLabel?: string;
}

const sides: Record<DrawerSide, string> = {
  right: 'inset-y-0 right-0 h-full w-full max-w-md translate-x-0 rounded-none sm:rounded-l-2xl',
  left: 'inset-y-0 left-0 h-full w-full max-w-sm rounded-none sm:rounded-r-2xl',
  bottom: 'inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-2xl sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
  center: 'inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-2xl sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
};

export function Drawer({
  open,
  onClose,
  title,
  hideTitle,
  side = 'right',
  children,
  footer,
  className,
  headerExtra,
  closeLabel = 'Cerrar',
}: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      document.body.style.overflow = 'hidden';
    } else if (!open && el.open) {
      el.close();
    }
    return () => {
      if (!open) document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const onCloseEv = () => {
      document.body.style.overflow = '';
    };
    el.addEventListener('cancel', onCancel);
    el.addEventListener('close', onCloseEv);
    return () => {
      el.removeEventListener('cancel', onCancel);
      el.removeEventListener('close', onCloseEv);
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(e) => {
        // Click en el backdrop (fuera del panel) cierra.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        'fixed m-0 flex max-w-none flex-col bg-blanco p-0 text-negro shadow-2xl backdrop:bg-negro/50',
        'open:animate-[drawer-in_.22s_ease-out]',
        sides[side],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-negro/10 px-4 py-3 sm:px-5">
        <h2
          id={titleId}
          className={cn('font-text text-base font-semibold', hideTitle && 'sr-only')}
        >
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {headerExtra}
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-negro hover:bg-negro/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche"
          >
            <IconClose />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
        {children}
      </div>
      {footer && (
        <div className="border-t border-negro/10 px-4 py-3 sm:px-5 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      )}
    </dialog>
  );
}
