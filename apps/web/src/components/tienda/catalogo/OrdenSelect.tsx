'use client';
import { useRouter } from 'next/navigation';
import { IconChevronDown } from '@vedere/ui';
import { ORDENES, urlQuery } from '@/lib/tienda/filtros';
import type { FiltrosActivos, Orden } from '@/lib/tienda/filtros';

export function OrdenSelect({
  value,
  basePath,
  filtros,
}: {
  value: Orden;
  basePath: string;
  filtros: FiltrosActivos;
}) {
  const router = useRouter();
  return (
    <div className="relative">
      <label htmlFor="orden" className="sr-only">
        Ordenar por
      </label>
      <select
        id="orden"
        value={value}
        onChange={(e) =>
          router.push(`${basePath}${urlQuery({ ...filtros, orden: e.target.value as Orden, page: 1 })}`, {
            scroll: false,
          })
        }
        className="font-text h-11 appearance-none rounded-full border border-negro/15 bg-blanco pl-4 pr-9 text-sm text-negro focus:border-negro focus:outline-none"
      >
        {ORDENES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-negro"
      />
    </div>
  );
}
