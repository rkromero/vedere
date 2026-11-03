// Listado de productos (categoría, colección, línea o búsqueda) con filtros en la URL.
import Link from 'next/link';
import { Container, IconClose, cn } from '@vedere/ui';
import { catalogo } from '@/lib/tienda/api';
import {
  apiQuery,
  chipsActivos,
  limpiarFiltros,
  parseFiltros,
  sinFiltro,
  urlQuery,
} from '@/lib/tienda/filtros';
import type { ContextoListado, SearchParams } from '@/lib/tienda/filtros';
import { textoSobre } from '@/lib/tienda/color';
import { ProductCard } from '../ProductCard';
import { Filtros } from './Filtros';
import { MasProductos } from './MasProductos';
import { OrdenSelect } from './OrdenSelect';

export interface ListadoProps {
  titulo: string;
  descripcion?: string;
  basePath: string;
  ctx: ContextoListado;
  searchParams: SearchParams;
  /** Color de fondo de la cabecera (colecciones). */
  colorHex?: string;
  /** Mostrar el filtro de línea (no aplica cuando la línea es el contexto). */
  mostrarLinea?: boolean;
}

export async function Listado({
  titulo,
  descripcion,
  basePath,
  ctx,
  searchParams,
  colorHex,
  mostrarLinea = !ctx.linea,
}: ListadoProps) {
  const f = parseFiltros(searchParams);
  const [filtros, pagina] = await Promise.all([
    catalogo.filtros(),
    catalogo.productos(apiQuery(f, ctx)),
  ]);
  const chips = chipsActivos(f, mostrarLinea);
  const header = colorHex ? textoSobre(colorHex) : null;

  return (
    <>
      <section
        className={cn(header ? header.clase : 'bg-gris-claro text-negro')}
        style={colorHex ? { backgroundColor: colorHex } : undefined}
      >
        <Container className="py-10 md:py-14">
          <h1 className="font-campaign text-5xl md:text-7xl">{titulo}</h1>
          {descripcion && (
            <p
              className={cn(
                'font-text mt-3 max-w-xl text-base md:text-lg',
                header && !header.oscuro ? 'text-blanco/85' : 'text-negro/75',
              )}
            >
              {descripcion}
            </p>
          )}
        </Container>
      </section>

      <Container className="py-6 md:py-8">
        <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-10">
          <Filtros
            disponibles={filtros}
            activos={f}
            basePath={basePath}
            mostrarLinea={mostrarLinea}
            modo="sidebar"
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-text text-sm text-gris-texto" aria-live="polite">
                {pagina.total === 0
                  ? 'Sin resultados'
                  : `${pagina.total} ${pagina.total === 1 ? 'modelo' : 'modelos'}`}
              </p>
              <div className="flex items-center gap-2">
                <Filtros
                  disponibles={filtros}
                  activos={f}
                  basePath={basePath}
                  mostrarLinea={mostrarLinea}
                  modo="drawer"
                />
                <OrdenSelect value={f.orden} basePath={basePath} filtros={f} />
              </div>
            </div>

            {chips.length > 0 && (
              <ul className="mt-4 flex flex-wrap items-center gap-2" aria-label="Filtros activos">
                {chips.map((chip) => (
                  <li key={`${chip.key}-${chip.value}`}>
                    <Link
                      href={`${basePath}${urlQuery(sinFiltro(f, chip))}`}
                      aria-label={`Quitar filtro ${chip.label}`}
                      className="font-text inline-flex h-9 items-center gap-1.5 rounded-full border border-negro/15 bg-blanco pl-3 pr-2 text-sm hover:border-negro"
                    >
                      {chip.label}
                      <IconClose size={16} />
                    </Link>
                  </li>
                ))}
                {chips.length > 1 && (
                  <li>
                    <Link
                      href={`${basePath}${urlQuery(limpiarFiltros(f))}`}
                      className="font-text inline-flex h-9 items-center px-2 text-sm underline underline-offset-4"
                    >
                      Limpiar todo
                    </Link>
                  </li>
                )}
              </ul>
            )}

            {pagina.items.length === 0 ? (
              <div className="font-text py-20 text-center">
                <p className="font-campaign text-4xl">Nada por acá</p>
                <p className="mt-3 text-gris-texto">
                  Probá quitando algún filtro o buscá con otra palabra.
                </p>
                {chips.length > 0 && (
                  <Link
                    href={`${basePath}${urlQuery(limpiarFiltros(f))}`}
                    className="mt-5 inline-flex h-12 items-center rounded-full bg-negro px-6 text-blanco"
                  >
                    Quitar filtros
                  </Link>
                )}
              </div>
            ) : (
              <>
                {/* Nivel intermedio para las tarjetas (h3) debajo del título (h1). */}
                <h2 className="sr-only">Productos</h2>
                <ul
                  className="mt-6 grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 lg:grid-cols-4"
                  aria-label="Productos"
                >
                  {pagina.items.map((p, i) => (
                    <li key={p.id}>
                      <ProductCard producto={p} priority={i < 2} />
                    </li>
                  ))}
                </ul>
                <MasProductos
                  apiQueryBase={apiQuery(f, ctx, 1).replace(/page=\d+/, 'page=PAGE')}
                  pageInicial={pagina.page}
                  totalPages={pagina.totalPages}
                  total={pagina.total}
                  pageSize={pagina.pageSize}
                  basePath={basePath}
                  urlQuery={urlQuery({ ...f, page: 1 }).replace(/^\?/, '')}
                />
              </>
            )}
          </div>
        </div>
      </Container>
    </>
  );
}
