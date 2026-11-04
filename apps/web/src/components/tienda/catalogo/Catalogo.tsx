'use client';
// Catálogo estilo Hawkers: barra fija con título, accesos rápidos por forma, cantidad, densidad de grilla
// y botón "Filtrar"; grilla a todo el ancho con separadores de 1px y "Más resultados" al final.
import { useState } from 'react';
import Link from 'next/link';
import { IconClose, IconFilter, cn } from '@vedere/ui';
import { LABELS } from '@/lib/format';
import { apiQuery, chipsActivos, limpiarFiltros, sinFiltro, urlQuery } from '@/lib/tienda/filtros';
import type { ContextoListado, FiltrosActivos } from '@/lib/tienda/filtros';
import type { Filtros as FiltrosDisponibles } from '@/lib/tienda/types';
import type { Paged, Producto } from '@/lib/types';
import { ProductCard } from '../ProductCard';
import { FiltrosDrawer } from './Filtros';
import { MasProductos } from './MasProductos';

type Densidad = 4 | 2;

const gridClase = (d: Densidad) =>
  cn('grid gap-px bg-negro/10', d === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2');

function IconGrilla({ cols }: { cols: Densidad }) {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="currentColor" aria-hidden="true">
      {cols === 4 ? (
        <>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="12" y="3" width="7" height="7" />
          <rect x="3" y="12" width="7" height="7" />
          <rect x="12" y="12" width="7" height="7" />
        </>
      ) : (
        <rect x="3" y="3" width="16" height="16" />
      )}
    </svg>
  );
}

function ChipForma({ href, activo, children }: { href: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={activo ? 'true' : undefined}
      className={cn(
        'inline-flex h-8 items-center whitespace-nowrap border px-3 text-[11px] font-semibold uppercase tracking-wider transition-colors',
        activo ? 'border-negro bg-negro text-blanco' : 'border-transparent text-negro/70 hover:text-negro max-md:border-negro/15',
      )}
    >
      {children}
    </Link>
  );
}

export function Catalogo({
  titulo,
  basePath,
  ctx,
  filtros,
  activos,
  pagina,
  mostrarLinea,
}: {
  titulo: string;
  basePath: string;
  ctx: ContextoListado;
  filtros: FiltrosDisponibles;
  activos: FiltrosActivos;
  pagina: Paged<Producto>;
  mostrarLinea: boolean;
}) {
  const [densidad, setDensidad] = useState<Densidad>(4);
  const [abierto, setAbierto] = useState(false);
  const chips = chipsActivos(activos, mostrarLinea);
  const formaSola = activos.forma.length === 1 ? activos.forma[0] : null;
  const sizes = densidad === 4 ? '(min-width: 1024px) 25vw, 50vw' : '(min-width: 640px) 50vw, 100vw';

  const formas = filtros.formas.length > 1 && (
    <ul className="flex items-center gap-1">
      <li>
        <ChipForma href={`${basePath}${urlQuery({ ...activos, forma: [], page: 1 })}`} activo={activos.forma.length === 0}>
          Ver todo
        </ChipForma>
      </li>
      {filtros.formas.map((o) => (
        <li key={o.valor}>
          <ChipForma
            href={`${basePath}${urlQuery({ ...activos, forma: [o.valor], page: 1 })}`}
            activo={formaSola === o.valor}
          >
            {LABELS.forma[o.valor]}
          </ChipForma>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <div className="font-text sticky top-16 z-30 border-b border-negro/10 bg-blanco">
        <div className="flex items-center gap-4 px-4 py-3 md:px-6">
          <h1 className="shrink-0 text-sm font-bold uppercase tracking-[0.12em] md:text-base">{titulo}</h1>

          {formas && (
            <nav aria-label="Formas" className="scrollbar-none hidden min-w-0 flex-1 overflow-x-auto md:block">
              {formas}
            </nav>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <p className="hidden text-xs text-gris-texto sm:block" aria-live="polite">
              {pagina.total} {pagina.total === 1 ? 'producto' : 'productos'}
            </p>
            <div className="hidden items-center sm:flex" role="group" aria-label="Productos por fila">
              {([4, 2] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDensidad(d)}
                  aria-pressed={densidad === d}
                  aria-label={d === 4 ? 'Ver más productos por fila' : 'Ver productos más grandes'}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center',
                    densidad === d ? 'text-negro' : 'text-negro/30 hover:text-negro/60',
                  )}
                >
                  <IconGrilla cols={d} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAbierto(true)}
              data-testid="filtros-abrir"
              className="inline-flex h-9 items-center gap-2 border border-negro px-3 text-[11px] font-semibold uppercase tracking-wider transition-colors hover:bg-negro hover:text-blanco"
            >
              <IconFilter size={16} />
              Filtrar
              {chips.length > 0 && <span>({chips.length})</span>}
            </button>
          </div>
        </div>

        {formas && (
          <nav aria-label="Formas" className="scrollbar-none overflow-x-auto px-4 pb-3 md:hidden">
            {formas}
          </nav>
        )}
      </div>

      {chips.length > 0 && (
        <ul className="font-text flex flex-wrap items-center gap-2 px-4 py-3 md:px-6" aria-label="Filtros activos">
          {chips.map((chip) => (
            <li key={`${chip.key}-${chip.value}`}>
              <Link
                href={`${basePath}${urlQuery(sinFiltro(activos, chip))}`}
                aria-label={`Quitar filtro ${chip.label}`}
                className="inline-flex h-8 items-center gap-1.5 border border-negro/15 pl-3 pr-2 text-xs uppercase tracking-wider hover:border-negro"
              >
                {chip.label}
                <IconClose size={14} />
              </Link>
            </li>
          ))}
          {chips.length > 1 && (
            <li>
              <Link
                href={`${basePath}${urlQuery(limpiarFiltros(activos))}`}
                className="inline-flex h-8 items-center px-2 text-xs uppercase tracking-wider underline underline-offset-4"
              >
                Eliminar filtros
              </Link>
            </li>
          )}
        </ul>
      )}

      {pagina.items.length === 0 ? (
        <div className="font-text px-4 py-24 text-center">
          <p className="text-lg font-semibold uppercase tracking-wider">No encontramos productos</p>
          <p className="mt-3 text-gris-texto">Probá quitando algún filtro o buscá con otra palabra.</p>
          {chips.length > 0 && (
            <Link
              href={`${basePath}${urlQuery(limpiarFiltros(activos))}`}
              className="mt-6 inline-flex h-12 items-center bg-negro px-8 text-xs font-semibold uppercase tracking-wider text-blanco"
            >
              Eliminar filtros
            </Link>
          )}
        </div>
      ) : (
        <>
          <h2 className="sr-only">Productos</h2>
          <ul className={cn(gridClase(densidad), 'border-b border-negro/10')} aria-label="Productos">
            {pagina.items.map((p, i) => (
              <li key={p.id} className="bg-blanco">
                <ProductCard producto={p} priority={i < 4} sizes={sizes} />
              </li>
            ))}
          </ul>
          <MasProductos
            apiQueryBase={apiQuery(activos, ctx, 1).replace(/page=\d+/, 'page=PAGE')}
            pageInicial={pagina.page}
            totalPages={pagina.totalPages}
            total={pagina.total}
            pageSize={pagina.pageSize}
            basePath={basePath}
            urlQuery={urlQuery({ ...activos, page: 1 }).replace(/^\?/, '')}
            gridClassName={gridClase(densidad)}
            sizes={sizes}
          />
        </>
      )}

      <FiltrosDrawer
        open={abierto}
        onClose={() => setAbierto(false)}
        disponibles={filtros}
        activos={activos}
        basePath={basePath}
        ctx={ctx}
        mostrarLinea={mostrarLinea}
        totalActual={pagina.total}
      />
    </>
  );
}
