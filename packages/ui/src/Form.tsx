'use client';
import { useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';

const base =
  'w-full rounded-xl border border-negro/20 bg-blanco px-4 text-base text-negro placeholder:text-gris-texto/80 transition-colors focus:border-negro focus:outline-none focus-visible:ring-2 focus-visible:ring-noche/40 disabled:bg-gris-claro disabled:text-gris-texto aria-[invalid=true]:border-carey';

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  /** Oculta visualmente la etiqueta (sigue siendo accesible). */
  hideLabel?: boolean;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: true;
    required?: boolean;
  }) => ReactNode;
}

/** Etiqueta + control + ayuda/error enlazados por id (render prop). */
export function Field({ label, hint, error, required, className, hideLabel, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = error || hint ? hintId : undefined;
  return (
    <div className={cn('font-text', className)}>
      <label
        htmlFor={id}
        className={cn('mb-1.5 block text-sm font-medium text-negro', hideLabel && 'sr-only')}
      >
        {label}
        {required && (
          <span aria-hidden="true" className="text-carey">
            {' '}
            *
          </span>
        )}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required,
      })}
      {(error || hint) && (
        <p
          id={hintId}
          className={cn('mt-1.5 text-sm', error ? 'text-carey' : 'text-gris-texto')}
          role={error ? 'alert' : undefined}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, 'h-12', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, 'min-h-[120px] py-3', className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={cn(base, 'h-12 appearance-none pr-10', className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        'font-text inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm text-negro',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="h-5 w-5 shrink-0 rounded border-negro/30 accent-negro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche"
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
}
