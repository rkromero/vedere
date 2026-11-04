'use client';
// Scroll infinito: carga las páginas siguientes al acercarse al final (con botón de respaldo)
// y mantiene la URL compartible actualizando ?page=.
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@vedere/ui';
import { tiendaApi } from '@/lib/tienda/client';
import type { Paged, Producto } from '@/lib/types';
import { ProductCard } from '../ProductCard';

export function MasProductos({
  apiQueryBase,
  pageInicial,
  totalPages,
  total,
  pageSize,
  basePath,
  urlQuery,
  gridClassName,
  sizes,
}: {
  /** Query de la API con el marcador PAGE en lugar del número de página. */
  apiQueryBase: string;
  pageInicial: number;
  totalPages: number;
  total: number;
  pageSize: number;
  basePath: string;
  /** Query string de la URL de la página sin "?" ni page. */
  urlQuery: string;
  /** Clases de la grilla (misma densidad que la primera página). */
  gridClassName: string;
  sizes?: string;
}) {
  const [page, setPage] = useState(pageInicial);
  const [items, setItems] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const hayMas = page < totalPages;

  // Si cambia el listado (filtros nuevos), reiniciar.
  useEffect(() => {
    setItems([]);
    setPage(pageInicial);
    setError(false);
  }, [apiQueryBase, pageInicial]);

  const cargar = useCallback(async () => {
    if (cargando || !hayMas) return;
    setCargando(true);
    setError(false);
    const siguiente = page + 1;
    try {
      const res = await tiendaApi.get<Paged<Producto>>(
        `/catalogo/productos${apiQueryBase.replace('PAGE', String(siguiente))}`,
      );
      setItems((prev) => [...prev, ...res.items]);
      setPage(siguiente);
      const sp = new URLSearchParams(urlQuery);
      sp.set('page', String(siguiente));
      window.history.replaceState(window.history.state, '', `${basePath}?${sp.toString()}`);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [apiQueryBase, basePath, cargando, hayMas, page, urlQuery]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hayMas) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void cargar();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cargar, hayMas]);

  const vistos = Math.min(total, page * pageSize);

  return (
    <div className="font-text">
      {items.length > 0 && (
        <ul className={cn(gridClassName, 'border-b border-negro/10')} aria-label="Más productos">
          {items.map((p) => (
            <li key={p.id} className="bg-blanco">
              <ProductCard producto={p} sizes={sizes} />
            </li>
          ))}
        </ul>
      )}
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-xs uppercase tracking-wider text-gris-texto">
        <p aria-live="polite">
          Viste {vistos} de {total} productos
        </p>
        <div className="h-0.5 w-48 bg-negro/10" aria-hidden="true">
          <div className="h-full bg-negro" style={{ width: `${total ? (vistos / total) * 100 : 0}%` }} />
        </div>
        {error && <p className="text-carey">No pudimos cargar más productos.</p>}
        {hayMas && (
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={cargando}
            aria-busy={cargando || undefined}
            className="mt-2 h-12 border border-negro px-10 text-xs font-semibold uppercase tracking-wider text-negro transition-colors hover:bg-negro hover:text-blanco disabled:opacity-60"
          >
            {cargando ? 'Cargando…' : 'Más resultados'}
          </button>
        )}
      </div>
    </div>
  );
}
