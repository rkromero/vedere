'use client';
// Ficha de producto: el color elegido cambia fotos, stock y botón; "Agregar al carrito" fijo abajo en
// celular; "Usar con mi receta" en recetados; guía de talles; envío y ajuste en óptica socia.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  ColorSwatches,
  Disclosure,
  IconCheck,
  IconGlasses,
  IconRuler,
  IconTruck,
  Price,
  Tag,
  cuotas,
  formatARS,
} from '@vedere/ui';
import { site } from '@/config/site';
import { LABELS } from '@/lib/format';
import type { Producto } from '@/lib/types';
import { useCart } from '@/lib/tienda/cart';
import { useCuotas } from '@/lib/tienda/comercial';
import { varianteInicial, LINEA_SLUG } from '@/lib/tienda/producto';
import { registrarReciente } from '@/lib/tienda/recientes';
import { track } from '@/lib/analytics';
import { FavoritoButton } from '@/components/tienda/cuenta/FavoritoButton';
import { AvisameForm } from './AvisameForm';
import { Galeria } from './Galeria';
import { GuiaTalles } from './GuiaTalles';

export function ProductoDetalle({
  producto,
  varianteInicialId = null,
}: {
  producto: Producto;
  /** `?v=` de la URL, resuelto en el servidor para que el primer render ya tenga el color. */
  varianteInicialId?: string | null;
}) {
  const { agregar } = useCart();
  const [varianteId, setVarianteId] = useState(
    () => varianteInicial(producto, varianteInicialId)?.id ?? '',
  );
  const [conReceta, setConReceta] = useState(false);
  const [agregado, setAgregado] = useState(false);
  const [guia, setGuia] = useState(false);

  const variante = useMemo(
    () => producto.variantes.find((v) => v.id === varianteId) ?? producto.variantes[0] ?? null,
    [producto.variantes, varianteId],
  );

  useEffect(() => registrarReciente(producto.slug), [producto.slug]);

  // view_item (GA4 / ViewContent en Meta): una vez por ficha, con el color inicial.
  useEffect(() => {
    const v = varianteInicial(producto, varianteInicialId) ?? producto.variantes[0];
    track('view_item', {
      value: producto.precio,
      items: [
        {
          item_id: v?.sku ?? producto.id,
          item_name: producto.nombre,
          item_brand: producto.marca?.nombre,
          item_category: producto.linea,
          item_variant: v?.colorArmazon,
          price: producto.precio,
          quantity: 1,
        },
      ],
    });
    // Sólo al montar la ficha de este producto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto.id]);

  function elegirColor(id: string) {
    setVarianteId(id);
    setAgregado(false);
    // URL compartible con el color elegido, sin recargar ni agregar historial.
    const url = new URL(window.location.href);
    url.searchParams.set('v', id);
    window.history.replaceState(window.history.state, '', url);
  }

  const sinStock = !variante || variante.stock <= 0;
  const pocoStock = !!variante && variante.stock > 0 && variante.stock <= 3;
  const esRecetado = producto.permiteReceta;
  const nCuotas = useCuotas(producto.linea);
  const { calibreMm, puenteMm, varillaMm } = producto.medidas;
  const tieneMedidas = !!(calibreMm || puenteMm || varillaMm);

  function onAgregar() {
    if (!variante || sinStock) return;
    agregar(producto, variante, { conReceta: esRecetado && conReceta });
    setAgregado(true);
  }

  const etiquetas = (
    <>
      {producto.nuevo && <Tag tone="blanco">Nuevo</Tag>}
      {producto.edicionLimitada && <Tag tone="negro">Edición limitada</Tag>}
    </>
  );

  const botonAgregar = sinStock ? (
    <Button size="lg" className="w-full" disabled aria-disabled="true">
      Avisame cuando vuelva
    </Button>
  ) : (
    <Button size="lg" className="w-full" onClick={onAgregar} data-testid="add-to-cart">
      {agregado ? (
        <>
          <IconCheck size={20} /> Agregado
        </>
      ) : (
        `Agregar al carrito · ${formatARS(producto.precio)}`
      )}
    </Button>
  );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_26rem] lg:gap-12 xl:grid-cols-[1fr_28rem]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Galeria
          imagenes={variante?.imagenes ?? []}
          nombre={producto.nombre}
          color={variante?.colorArmazon ?? ''}
          etiquetas={etiquetas}
        />
      </div>

      <div className="font-text mt-6 lg:mt-0">
        <nav aria-label="Migas de pan" className="mb-3 text-sm text-gris-texto">
          <ol className="flex flex-wrap gap-1">
            <li>
              <Link href="/" className="hover:underline underline-offset-4">
                Inicio
              </Link>
              <span aria-hidden="true"> / </span>
            </li>
            <li>
              <Link href={`/${LINEA_SLUG[producto.linea]}`} className="hover:underline underline-offset-4">
                {LABELS.linea[producto.linea]}
              </Link>
            </li>
            {producto.coleccion && (
              <li>
                <span aria-hidden="true"> / </span>
                <Link
                  href={`/coleccion/${producto.coleccion.slug}`}
                  className="hover:underline underline-offset-4"
                >
                  {producto.coleccion.nombre}
                </Link>
              </li>
            )}
          </ol>
        </nav>

        {producto.marca && <p className="text-sm text-gris-texto">{producto.marca.nombre}</p>}
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">{producto.nombre}</h1>
          <FavoritoButton productoId={producto.id} className="mt-1 shrink-0" />
        </div>
        <Price
          precio={producto.precio}
          precioLista={producto.precioLista}
          cuotas={nCuotas}
          size="lg"
          className="mt-3"
        />

        <div className="mt-6">
          <ColorSwatches
            label="Color"
            value={variante?.id ?? ''}
            onChange={elegirColor}
            opciones={producto.variantes.map((v) => ({
              id: v.id,
              nombre: v.colorArmazon + (v.colorLente ? ` · lente ${v.colorLente}` : ''),
              hex: v.colorArmazonHex,
              disponible: v.stock > 0,
            }))}
          />
          <p className="mt-2 text-sm" aria-live="polite">
            {sinStock ? (
              <span className="text-carey">Sin stock en este color.</span>
            ) : pocoStock ? (
              <span className="text-carey">¡Quedan {variante.stock}!</span>
            ) : (
              <span className="text-gris-texto">En stock · SKU {variante?.sku}</span>
            )}
          </p>
        </div>

        {esRecetado && (
          <label className="mt-5 flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border border-negro/15 p-4">
            <input
              type="checkbox"
              checked={conReceta}
              onChange={(e) => setConReceta(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-negro"
            />
            <span>
              <span className="block font-medium">Usar con mi receta</span>
              <span className="block text-sm text-gris-texto">
                Después de comprar cargás la receta o la llevás a tu óptica socia. Lentes con
                antirreflejo incluidos.
              </span>
            </span>
          </label>
        )}

        {/* Botón: fijo abajo en celular, en flujo en desktop */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-negro/10 bg-blanco/95 p-3 backdrop-blur [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0">
          {botonAgregar}
          {!sinStock && (
            <p className="mt-1.5 hidden text-center text-sm text-gris-texto lg:block">
              {cuotas(producto.precio, nCuotas).texto}
            </p>
          )}
        </div>
        {/* Espacio para que el botón fijo no tape contenido en celular */}
        <div aria-hidden="true" className="h-20 lg:hidden" />

        {sinStock && variante && (
          <div className="mt-5">
            <AvisameForm varianteId={variante.id} />
          </div>
        )}

        {agregado && !sinStock && (
          <p className="mt-3 text-sm" role="status">
            Listo, lo sumamos a tu carrito.{' '}
            <Link href="/checkout" className="underline underline-offset-4">
              Ir a pagar
            </Link>
          </p>
        )}

        <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <li className="flex items-start gap-2 rounded-2xl bg-gris-claro p-3">
            <IconTruck className="mt-0.5 shrink-0" size={20} />
            <span>
              Envío gratis desde {formatARS(site.comercial.envioGratisDesde)} o retiro en tu óptica
              socia.
            </span>
          </li>
          <li className="flex items-start gap-2 rounded-2xl bg-gris-claro p-3">
            <IconGlasses className="mt-0.5 shrink-0" size={20} />
            <span>Ajuste gratis en la óptica socia más cercana, todas las veces que necesites.</span>
          </li>
        </ul>

        <div className="mt-8">
          {producto.descripcion && (
            <Disclosure summary="Descripción" defaultOpen>
              <p className="whitespace-pre-line">{producto.descripcion}</p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {producto.forma && (
                  <>
                    <dt className="text-gris-texto">Forma</dt>
                    <dd>{LABELS.forma[producto.forma]}</dd>
                  </>
                )}
                {producto.material && (
                  <>
                    <dt className="text-gris-texto">Material</dt>
                    <dd>{LABELS.material[producto.material]}</dd>
                  </>
                )}
                <dt className="text-gris-texto">Género</dt>
                <dd>{LABELS.genero[producto.genero]}</dd>
                {variante?.colorLente && (
                  <>
                    <dt className="text-gris-texto">Lente</dt>
                    <dd>{variante.colorLente}</dd>
                  </>
                )}
              </dl>
            </Disclosure>
          )}
          {tieneMedidas && (
            <Disclosure summary="Medidas del armazón" defaultOpen>
              <dl className="grid grid-cols-3 gap-3 text-center">
                {[
                  ['Calibre', calibreMm],
                  ['Puente', puenteMm],
                  ['Varilla', varillaMm],
                ].map(([k, v]) => (
                  <div key={String(k)} className="rounded-2xl bg-gris-claro p-3">
                    <dt className="text-xs uppercase tracking-wide text-gris-texto">{k}</dt>
                    <dd className="text-xl font-semibold">{v ? `${v} mm` : '—'}</dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                onClick={() => setGuia(true)}
                className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm underline underline-offset-4"
              >
                <IconRuler size={18} /> Guía de talles: ¿cómo sé si me queda?
              </button>
            </Disclosure>
          )}
          <Disclosure summary="Envío y ajuste en óptica socia">
            <ul className="list-disc space-y-1 pl-5">
              <li>Retiro gratis en tu óptica socia, lista para usar y ajustada a tu cara.</li>
              <li>
                Envío a domicilio en todo el país. Gratis desde{' '}
                {formatARS(site.comercial.envioGratisDesde)}.
              </li>
              <li>
                Recetados y multifocales: la óptica arma los lentes; demora de 5 a 10 días hábiles.
              </li>
              <li>
                Cambios y devoluciones dentro de los {site.comercial.diasCambio} días.{' '}
                <Link href="/cambios-y-devoluciones" className="underline underline-offset-4">
                  Ver condiciones
                </Link>
                .
              </li>
            </ul>
          </Disclosure>
        </div>
      </div>

      <GuiaTalles open={guia} onClose={() => setGuia(false)} medidas={producto.medidas} />
    </div>
  );
}
