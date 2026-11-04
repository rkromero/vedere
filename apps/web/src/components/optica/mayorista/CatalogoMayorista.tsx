'use client';
// Catálogo mayorista del portal: grilla o lista compacta, filtros en la URL y un campo de cantidad por
// variante para cargar muchos modelos de una sin entrar a cada ficha. El precio es el de ESTA óptica.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { cn } from '@vedere/ui';
import { api, errorMessage } from '@/lib/api-client';
import { LABELS, formatPrecio } from '@/lib/format';
import type { AjusteStock, CarritoMayorista, Condiciones, FiltrosMayorista, ProductoMayorista } from '@/lib/mayorista';
import { MINIMO_LABEL, textoAjuste } from '@/lib/mayorista';
import type { Paged } from '@/components/admin/table';
import { FilterSelect, Pagination, SearchInput, Toolbar, useQueryParams } from '@/components/admin/table';
import { Btn, EmptyState, LinkBtn, PageHeader } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';
import { CantidadInput, StockLabel } from './piezas';

export function CatalogoMayorista({
  data,
  filtros,
  condiciones,
  unidadesCarrito,
}: {
  data: Paged<ProductoMayorista>;
  filtros: FiltrosMayorista;
  condiciones: Condiciones;
  unidadesCarrito: number;
}) {
  const toast = useToast();
  const { get, set } = useQueryParams();
  const vista = get('vista') === 'lista' ? 'lista' : 'grilla';
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [enCarrito, setEnCarrito] = useState(unidadesCarrito);
  const [agregando, setAgregando] = useState(false);
  const [ajustes, setAjustes] = useState<AjusteStock[]>([]);

  const precioPorVariante = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of data.items) for (const v of p.variantes) m.set(v.id, p.precio.unitario);
    return m;
  }, [data.items]);
  const seleccion = Object.entries(cantidades).filter(([, c]) => c > 0);
  const unidadesSel = seleccion.reduce((a, [, c]) => a + c, 0);
  const importeSel = seleccion.reduce((a, [id, c]) => a + (precioPorVariante.get(id) ?? 0) * c, 0);

  const setCantidad = (id: string, c: number) => setCantidades((prev) => ({ ...prev, [id]: c }));

  async function agregar() {
    setAgregando(true);
    try {
      const r = await api.put<CarritoMayorista>('/optica/mayorista/carrito', {
        modo: 'sumar',
        items: seleccion.map(([varianteId, cantidad]) => ({ varianteId, cantidad })),
      });
      setEnCarrito(r.unidades);
      setAjustes(r.ajustes ?? []);
      setCantidades({});
      toast.ok(`Agregamos ${unidadesSel} ${unidadesSel === 1 ? 'unidad' : 'unidades'} al carrito`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAgregando(false);
    }
  }

  const minimo = condiciones.minimo;
  const textoMinimo =
    minimo.tipo === 'NINGUNO' || minimo.valor <= 0
      ? 'Sin compra mínima'
      : minimo.tipo === 'UNIDADES'
        ? `Compra mínima: ${minimo.valor} unidades`
        : `Compra mínima: ${formatPrecio(minimo.valor)} + IVA`;

  return (
    <div className={cn(unidadesSel > 0 && 'pb-24')}>
      <PageHeader
        title="Catálogo mayorista"
        description="Precios para tu óptica, sin IVA. Cargá cantidades en cada color y agregalas al carrito de una sola vez."
        actions={
          <LinkBtn href="/optica/carrito" variant="secondary">
            Carrito{enCarrito > 0 ? ` (${enCarrito} u.)` : ''}
          </LinkBtn>
        }
      />

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-xl border border-negro/10 bg-blanco px-4 py-3 text-sm" data-testid="condiciones">
        <span>
          Tu descuento: <strong>{condiciones.descuentoPct}%</strong> sobre la lista mayorista
        </span>
        <span>IVA {condiciones.ivaPct}% (se suma aparte)</span>
        <span title={minimo.propio ? 'Condición especial de tu óptica' : MINIMO_LABEL[minimo.tipo]}>{textoMinimo}</span>
      </div>

      <Toolbar>
        <SearchInput placeholder="Buscar por nombre o SKU…" />
        <FilterSelect param="categoria" label="Categoría" options={filtros.categorias.map((c) => ({ value: c.slug, label: c.nombre }))} />
        <FilterSelect
          param="linea"
          label="Línea"
          options={filtros.lineas.map((l) => ({ value: l.valor, label: LABELS.linea[l.valor as keyof typeof LABELS.linea] ?? l.valor }))}
        />
        <FilterSelect
          param="forma"
          label="Forma"
          options={filtros.formas.map((f) => ({ value: f.valor, label: LABELS.forma[f.valor as keyof typeof LABELS.forma] ?? f.valor }))}
        />
        <FilterSelect param="color" label="Color" options={filtros.colores.map((c) => ({ value: c.valor, label: c.valor }))} />
        <FilterSelect param="marca" label="Marca" allLabel="Todas" options={filtros.marcas.map((m) => ({ value: m.slug, label: m.nombre }))} />
        <FilterSelect
          param="coleccion"
          label="Colección"
          allLabel="Todas"
          options={filtros.colecciones.map((c) => ({ value: c.slug, label: c.nombre }))}
        />
        <label className="flex h-10 items-center gap-2 rounded-lg border border-negro/20 bg-blanco px-3 text-sm">
          <input
            type="checkbox"
            checked={get('soloConStock') === 'true'}
            onChange={(e) => set({ soloConStock: e.target.checked ? 'true' : undefined })}
          />
          Con stock
        </label>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-negro/20" role="group" aria-label="Vista">
          {(['grilla', 'lista'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={vista === v}
              onClick={() => set({ vista: v === 'grilla' ? undefined : 'lista' }, { keepPage: true })}
              className={cn('h-10 px-3 text-sm capitalize', vista === v ? 'bg-negro text-blanco' : 'bg-blanco hover:bg-gris-claro')}
            >
              {v}
            </button>
          ))}
        </div>
      </Toolbar>

      {ajustes.length > 0 && (
        <div role="status" className="mb-4 rounded-lg bg-sol/25 px-4 py-3 text-sm" data-testid="ajustes-stock">
          <p className="font-medium">Ajustamos algunas cantidades por stock:</p>
          <ul className="mt-1 list-disc pl-5">
            {ajustes.map((a) => (
              <li key={a.varianteId + a.sku}>{textoAjuste(a)}</li>
            ))}
          </ul>
        </div>
      )}

      {data.items.length === 0 ? (
        <EmptyState title="No hay modelos con esos filtros" description="Probá con otra búsqueda o quitá algún filtro." />
      ) : vista === 'lista' ? (
        <VistaLista productos={data.items} cantidades={cantidades} setCantidad={setCantidad} />
      ) : (
        <VistaGrilla productos={data.items} cantidades={cantidades} setCantidad={setCantidad} />
      )}

      <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} />

      {unidadesSel > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-negro/10 bg-blanco/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <strong>{unidadesSel}</strong> {unidadesSel === 1 ? 'unidad' : 'unidades'} de {seleccion.length}{' '}
              {seleccion.length === 1 ? 'color' : 'colores'} · <strong>{formatPrecio(importeSel)}</strong> + IVA
            </p>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => setCantidades({})}>
                Limpiar
              </Btn>
              <Btn onClick={agregar} loading={agregando} data-testid="agregar-carrito">
                Agregar al carrito
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface VistaProps {
  productos: ProductoMayorista[];
  cantidades: Record<string, number>;
  setCantidad: (id: string, c: number) => void;
}

function Precios({ p, compacto }: { p: ProductoMayorista['precio']; compacto?: boolean }) {
  return (
    <div className={cn('text-sm', compacto ? 'space-y-0.5' : 'space-y-1')}>
      <p>
        <span className="text-base font-semibold">{formatPrecio(p.unitario)}</span>
        <span className="text-gris-medio"> + IVA {formatPrecio(p.iva)}</span>
      </p>
      {p.descuentoPct > 0 && (
        <p className="text-xs text-gris-medio">
          Lista {formatPrecio(p.lista)} · tu descuento {p.descuentoPct}%
        </p>
      )}
      <p className="text-xs text-gris-medio">
        Sugerido al público {formatPrecio(p.sugerido)}
        {p.margenPct !== null && (
          <>
            {' '}
            · margen <strong className={cn(p.margenPct < 0 ? 'text-carey' : 'text-negro')}>{p.margenPct}%</strong>
          </>
        )}
      </p>
    </div>
  );
}

function VistaGrilla({ productos, cantidades, setCantidad }: VistaProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="catalogo-grilla">
      {productos.map((p) => {
        const img = p.variantes.find((v) => v.imagen)?.imagen;
        return (
          <li key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-negro/10 bg-blanco">
            <Link href={`/optica/catalogo/${p.slug}`} className="block aspect-[5/3] bg-gris-claro">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt={p.nombre} className="h-full w-full object-contain p-3" loading="lazy" />
              ) : (
                <span className="flex h-full items-center justify-center text-xs text-gris-medio">Sin foto</span>
              )}
            </Link>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <Link href={`/optica/catalogo/${p.slug}`} className="font-medium hover:underline">
                  {p.nombre}
                </Link>
                <p className="text-xs text-gris-medio">
                  {[p.marca?.nombre, LABELS.linea[p.linea as keyof typeof LABELS.linea]].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Precios p={p.precio} />
              <ul className="mt-auto divide-y divide-negro/5 border-t border-negro/10">
                {p.variantes.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-negro/20"
                      style={{ backgroundColor: v.colorArmazonHex ?? undefined }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {v.colorArmazon}
                      <span className="block font-mono text-[11px] text-gris-medio">{v.sku}</span>
                    </span>
                    <StockLabel disponible={v.disponible} />
                    <CantidadInput
                      value={cantidades[v.id] ?? 0}
                      max={v.disponible}
                      onChange={(c) => setCantidad(v.id, c)}
                      label={`Cantidad de ${p.nombre} ${v.colorArmazon}`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function VistaLista({ productos, cantidades, setCantidad }: VistaProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-negro/10 bg-blanco">
      <table className="w-full min-w-[860px] text-sm" data-testid="catalogo-lista">
        <thead className="border-b border-negro/10 text-left text-xs uppercase tracking-wide text-gris-medio">
          <tr>
            <th className="px-3 py-2 font-medium">Modelo</th>
            <th className="px-3 py-2 font-medium">Color / SKU</th>
            <th className="px-3 py-2 font-medium">Stock</th>
            <th className="px-3 py-2 text-right font-medium">Precio s/IVA</th>
            <th className="px-3 py-2 text-right font-medium">IVA</th>
            <th className="px-3 py-2 text-right font-medium">Sugerido</th>
            <th className="px-3 py-2 text-right font-medium">Margen</th>
            <th className="px-3 py-2 text-right font-medium">Cantidad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-negro/5">
          {productos.flatMap((p) =>
            p.variantes.map((v, i) => (
              <tr key={v.id} className="align-middle">
                <td className="px-3 py-2">
                  {i === 0 ? (
                    <Link href={`/optica/catalogo/${p.slug}`} className="font-medium hover:underline">
                      {p.nombre}
                    </Link>
                  ) : (
                    <span className="sr-only">{p.nombre}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-negro/20"
                      style={{ backgroundColor: v.colorArmazonHex ?? undefined }}
                      aria-hidden="true"
                    />
                    {v.colorArmazon}
                    <span className="font-mono text-[11px] text-gris-medio">{v.sku}</span>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <StockLabel disponible={v.disponible} />
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{formatPrecio(p.precio.unitario)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gris-medio">{formatPrecio(p.precio.iva)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPrecio(p.precio.sugerido)}</td>
                <td className={cn('px-3 py-2 text-right tabular-nums', (p.precio.margenPct ?? 0) < 0 && 'text-carey')}>
                  {p.precio.margenPct !== null ? `${p.precio.margenPct}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <CantidadInput
                    value={cantidades[v.id] ?? 0}
                    max={v.disponible}
                    onChange={(c) => setCantidad(v.id, c)}
                    label={`Cantidad de ${p.nombre} ${v.colorArmazon}`}
                  />
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
