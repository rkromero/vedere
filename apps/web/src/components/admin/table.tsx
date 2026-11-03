'use client';
// Tabla, búsqueda y paginación sincronizadas con la URL (searchParams).
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@vedere/ui';
import { Btn, Select } from './ui';

/** Lee y actualiza parámetros de la URL (resetea page al cambiar filtros). */
export function useQueryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = useCallback(
    (updates: Record<string, string | undefined>, opts: { keepPage?: boolean } = {}) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === '') sp.delete(k);
        else sp.set(k, v);
      }
      if (!opts.keepPage && !('page' in updates)) sp.delete('page');
      const q = sp.toString();
      router.push(q ? `${pathname}?${q}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return { get: (k: string) => searchParams.get(k) ?? '', set, searchParams };
}

export function SearchInput({
  placeholder = 'Buscar…',
  param = 'q',
}: {
  placeholder?: string;
  param?: string;
}) {
  const { get, set } = useQueryParams();
  const [value, setValue] = useState(get(param));

  useEffect(() => setValue(get(param)), [get, param]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (value !== get(param)) set({ [param]: value || undefined });
    }, 350);
    return () => clearTimeout(t);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full sm:w-72">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-medio"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-negro/20 bg-blanco pl-9 pr-3 text-sm placeholder:text-gris-medio focus:border-negro focus:outline-none focus:ring-1 focus:ring-negro"
      />
    </div>
  );
}

export function FilterSelect({
  param,
  label,
  options,
  allLabel = 'Todos',
}: {
  param: string;
  label?: string;
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
}) {
  const { get, set } = useQueryParams();
  return (
    <div className="w-auto min-w-[9rem] max-w-full">
      <Select
        aria-label={label ?? param}
        value={get(param)}
        onChange={(e) => set({ [param]: e.target.value || undefined })}
        className="h-10"
      >
        <option value="">{label ? `${label}: ${allLabel}` : allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

// ---------- Tabla ----------
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-negro/10 bg-blanco', className)}>
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
  align = 'left',
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <th
      className={cn(
        'border-b border-negro/10 bg-gris-claro/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-negro/70',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = 'left',
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <td
      className={cn(
        'border-b border-negro/5 px-4 py-3 align-middle',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
  selected,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'transition-colors hover:bg-gris-claro/50',
        selected && 'bg-gris-claro/70',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}) {
  const { set } = useQueryParams();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 text-sm text-gris-medio sm:flex-row">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-2">
        <Btn
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => set({ page: String(page - 1) }, { keepPage: true })}
        >
          Anterior
        </Btn>
        <span className="text-negro">
          {page} / {totalPages}
        </span>
        <Btn
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => set({ page: String(page + 1) }, { keepPage: true })}
        >
          Siguiente
        </Btn>
      </div>
    </div>
  );
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
