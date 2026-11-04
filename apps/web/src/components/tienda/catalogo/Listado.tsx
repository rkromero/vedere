// Listado de productos (categoría, colección, línea o búsqueda) estilo Hawkers: franja compacta, barra
// fija con formas y "Filtrar", grilla a todo el ancho y texto SEO al pie. Filtros en la URL.
import Link from 'next/link';
import { cn } from '@vedere/ui';
import { LABELS } from '@/lib/format';
import { catalogo } from '@/lib/tienda/api';
import { apiQuery, parseFiltros, urlQuery } from '@/lib/tienda/filtros';
import type { ContextoListado, SearchParams } from '@/lib/tienda/filtros';
import { textoSobre } from '@/lib/tienda/color';
import { Catalogo } from './Catalogo';

export interface ListadoProps {
  titulo: string;
  descripcion?: string;
  basePath: string;
  ctx: ContextoListado;
  searchParams: SearchParams;
  /** Color de fondo de la franja (colecciones). */
  colorHex?: string;
  /** Mostrar el filtro de línea (no aplica cuando la línea es el contexto). */
  mostrarLinea?: boolean;
  /** Texto al pie del listado (SEO). */
  textoSeo?: { titulo: string; parrafos: string[] };
}

export async function Listado({
  titulo,
  descripcion,
  basePath,
  ctx,
  searchParams,
  colorHex,
  mostrarLinea = !ctx.linea,
  textoSeo,
}: ListadoProps) {
  const f = parseFiltros(searchParams);
  const [filtros, pagina] = await Promise.all([catalogo.filtros(), catalogo.productos(apiQuery(f, ctx))]);
  const header = colorHex ? textoSobre(colorHex) : null;

  return (
    <>
      {(descripcion || colorHex) && (
        <section
          className={cn('font-text', header ? header.clase : 'bg-gris-claro text-negro')}
          style={colorHex ? { backgroundColor: colorHex } : undefined}
        >
          <p
            className={cn(
              'px-4 py-2.5 text-center text-xs md:px-6',
              header && !header.oscuro ? 'text-blanco/85' : 'text-negro/70',
            )}
          >
            {descripcion}
          </p>
        </section>
      )}

      <Catalogo
        titulo={titulo}
        basePath={basePath}
        ctx={ctx}
        filtros={filtros}
        activos={f}
        pagina={pagina}
        mostrarLinea={mostrarLinea}
      />

      {textoSeo && (
        <section className="font-text border-t border-negro/10 px-4 py-14 md:px-6" aria-labelledby="seo-titulo">
          <div className="mx-auto max-w-3xl">
            <h2 id="seo-titulo" className="text-sm font-bold uppercase tracking-[0.12em]">
              {textoSeo.titulo}
            </h2>
            {textoSeo.parrafos.map((t, i) => (
              <p key={i} className="mt-4 text-sm leading-relaxed text-negro/70">
                {t}
              </p>
            ))}
            {filtros.formas.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-wider">
                {filtros.formas.map((o) => (
                  <li key={o.valor}>
                    <Link
                      href={`${basePath}${urlQuery({ forma: [o.valor] })}`}
                      className="underline underline-offset-4 hover:text-negro/70"
                    >
                      {titulo} {LABELS.forma[o.valor].toLowerCase()}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </>
  );
}
