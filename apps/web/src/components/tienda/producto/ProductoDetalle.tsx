'use client';
// Ficha de producto: galería en grilla a la izquierda y panel de compra fijo a la derecha. El color
// elegido (miniaturas) cambia fotos, stock y botón; "Agregar al carrito" fijo abajo en celular;
// "Usar con mi receta" en recetados; acordeones de características, medidas, garantía, envío y pago.
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Button,
  Disclosure,
  IconCheck,
  IconGlasses,
  IconRuler,
  IconTruck,
  Tag,
  cn,
  cuotas,
  formatARS,
} from '@vedere/ui';
import { site } from '@/config/site';
import { LABELS } from '@/lib/format';
import type { Producto } from '@/lib/types';
import { useCart } from '@/lib/tienda/cart';
import { useComercial, useCuotas } from '@/lib/tienda/comercial';
import { fechaEntregaEstimada, formatFechaEntrega } from '@/lib/tienda/entrega';
import { varianteInicial, LINEA_SLUG } from '@/lib/tienda/producto';
import { registrarReciente } from '@/lib/tienda/recientes';
import { track } from '@/lib/analytics';
import { FavoritoButton } from '@/components/tienda/cuenta/FavoritoButton';
import { AvisameForm } from './AvisameForm';
import { Galeria } from './Galeria';
import { GuiaTalles } from './GuiaTalles';

/** Título de acordeón: icono + mayúsculas chicas. */
function Titulo({ icono, children }: { icono?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider">
      {icono && <span className="text-negro/70">{icono}</span>}
      {children}
    </span>
  );
}

function IconPercent({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 5 5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </svg>
  );
}

function IconCard({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  );
}

function IconList({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

export function ProductoDetalle({
  producto,
  varianteInicialId = null,
}: {
  producto: Producto;
  /** `?v=` de la URL, resuelto en el servidor para que el primer render ya tenga el color. */
  varianteInicialId?: string | null;
}) {
  const { agregar } = useCart();
  const comercial = useComercial();
  const [varianteId, setVarianteId] = useState(
    () => varianteInicial(producto, varianteInicialId)?.id ?? '',
  );
  const [conReceta, setConReceta] = useState(false);
  const [agregado, setAgregado] = useState(false);
  const [guia, setGuia] = useState(false);
  const [entrega, setEntrega] = useState<string | null>(null);

  const variante = useMemo(
    () => producto.variantes.find((v) => v.id === varianteId) ?? producto.variantes[0] ?? null,
    [producto.variantes, varianteId],
  );

  useEffect(() => registrarReciente(producto.slug), [producto.slug]);

  // Fecha estimada de entrega: en el cliente, para no desincronizar la hidratación.
  useEffect(() => {
    const dias = producto.linea === 'RECETADO' || producto.linea === 'MULTIFOCAL' ? 10 : 5;
    setEntrega(formatFechaEntrega(fechaEntregaEstimada(dias)));
  }, [producto.linea]);

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
  const descuentoPct =
    producto.precioLista && producto.precioLista > producto.precio
      ? Math.round((1 - producto.precio / producto.precioLista) * 100)
      : 0;
  const descuentoTransferencia = comercial.transferencia?.descuento ?? 0;
  const nColores = producto.variantes.length;

  function onAgregar() {
    if (!variante || sinStock) return;
    agregar(producto, variante, { conReceta: esRecetado && conReceta });
    setAgregado(true);
  }

  const etiquetas = (
    <>
      {producto.nuevo && <Tag tone="blanco">Nuevo</Tag>}
      {producto.edicionLimitada && <Tag tone="negro">Edición limitada</Tag>}
      {producto.destacado && <Tag tone="sol">Más vendido</Tag>}
    </>
  );

  const botonAgregar = sinStock ? (
    <Button size="lg" className="w-full rounded-none uppercase tracking-wider" disabled aria-disabled="true">
      Avisame cuando vuelva
    </Button>
  ) : (
    <Button
      size="lg"
      className="w-full rounded-none uppercase tracking-wider"
      onClick={onAgregar}
      data-testid="add-to-cart"
    >
      {agregado ? (
        <>
          <IconCheck size={20} /> Agregado al carrito
        </>
      ) : (
        'Agregar al carrito'
      )}
    </Button>
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_26rem] xl:gap-12">
      <div className="min-w-0">
        <Galeria
          imagenes={variante?.imagenes ?? []}
          nombre={producto.nombre}
          color={variante?.colorArmazon ?? ''}
        />
      </div>

      <div className="font-text mt-6 px-4 lg:sticky lg:top-24 lg:mt-0 lg:self-start lg:px-0">
        <nav aria-label="Migas de pan" className="mb-4 text-sm text-gris-texto">
          <ol className="flex flex-wrap gap-1">
            <li>
              <Link
                href={`/${LINEA_SLUG[producto.linea]}`}
                className="underline underline-offset-4 hover:text-negro"
              >
                {producto.linea === 'ACCESORIO' ? 'Accesorios' : `Anteojos ${LABELS.linea[producto.linea].toLowerCase() === 'sol' ? 'de sol' : LABELS.linea[producto.linea].toLowerCase() + 's'}`}
              </Link>
            </li>
            {producto.coleccion && (
              <li>
                <span aria-hidden="true"> / </span>
                <Link
                  href={`/coleccion/${producto.coleccion.slug}`}
                  className="underline underline-offset-4 hover:text-negro"
                >
                  {producto.coleccion.nombre}
                </Link>
              </li>
            )}
          </ol>
        </nav>

        {(producto.nuevo || producto.edicionLimitada || producto.destacado) && (
          <div className="mb-3 flex flex-wrap gap-1.5">{etiquetas}</div>
        )}

        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold uppercase leading-tight tracking-wide md:text-2xl">
            {producto.nombre}
            {variante && (
              <span className="font-normal text-negro/70"> · {variante.colorArmazon}</span>
            )}
          </h1>
          <FavoritoButton productoId={producto.id} className="mt-0.5 shrink-0" />
        </div>
        {producto.marca && <p className="mt-1 text-sm text-gris-texto">{producto.marca.nombre}</p>}

        <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {descuentoPct > 0 && producto.precioLista && (
            <span className="text-base text-gris-texto line-through">{formatARS(producto.precioLista)}</span>
          )}
          <span
            className={cn('text-2xl font-semibold', descuentoPct > 0 ? 'text-[#e4002b]' : 'text-negro')}
            data-testid="producto-precio"
          >
            {formatARS(producto.precio)}
          </span>
          {descuentoPct > 0 && (
            <span className="text-sm font-semibold text-[#e4002b]">-{descuentoPct}%</span>
          )}
        </p>
        {nCuotas > 1 && (
          <p className="mt-1 text-sm text-gris-texto">{cuotas(producto.precio, nCuotas).texto}</p>
        )}

        {/* Colores: miniaturas de cada variante */}
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-gris-texto">
            {nColores} {nColores === 1 ? 'color' : 'colores'}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Elegí el color">
            {producto.variantes.map((v) => {
              const foto = v.imagenes[0];
              const activa = v.id === variante?.id;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => elegirColor(v.id)}
                    aria-pressed={activa}
                    aria-label={`${v.colorArmazon}${v.stock <= 0 ? ' (sin stock)' : ''}`}
                    title={v.colorArmazon}
                    data-testid="variante-color"
                    className={cn(
                      'relative block h-16 w-16 overflow-hidden bg-gris-claro transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche',
                      'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-negro after:transition-opacity',
                      activa ? 'after:opacity-100' : 'after:opacity-0 hover:after:opacity-40',
                      v.stock <= 0 && 'opacity-40',
                    )}
                  >
                    {foto ? (
                      <Image
                        src={foto.urlMiniatura ?? foto.urlMediana ?? foto.url}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="absolute inset-3 rounded-full border border-negro/10"
                        style={{ backgroundColor: v.colorArmazonHex ?? '#8A8A86' }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-sm" aria-live="polite">
            {sinStock ? (
              <span className="text-carey">Sin stock en este color.</span>
            ) : pocoStock ? (
              <span className="text-carey">¡Quedan {variante.stock}!</span>
            ) : (
              <span className="text-gris-texto">
                {variante?.colorArmazon}
                {variante?.colorLente ? ` · lente ${variante.colorLente}` : ''}
              </span>
            )}
          </p>
        </div>

        {esRecetado && (
          <label className="mt-5 flex min-h-12 cursor-pointer items-start gap-3 border border-negro/15 p-4">
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
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-negro/10 bg-blanco/95 p-3 backdrop-blur [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0">
          {botonAgregar}
        </div>
        {/* Espacio para que el botón fijo no tape contenido en celular */}
        <div aria-hidden="true" className="h-20 lg:hidden" />

        <Link
          href="/opticas"
          className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 border border-negro bg-blanco text-sm font-semibold uppercase tracking-wider text-negro transition-colors hover:bg-negro hover:text-blanco focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche focus-visible:ring-offset-2"
        >
          <IconGlasses size={18} /> Probalo en tu óptica socia
        </Link>

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

        <ul className="mt-5 space-y-1.5 text-sm">
          <li className="flex items-start gap-2">
            <IconCheck size={18} className="mt-0.5 shrink-0 text-vetro" />
            <span>
              {entrega ? (
                <>
                  Recibilo el <strong className="font-semibold">{entrega}</strong>.
                </>
              ) : (
                'Entrega estimada en pocos días hábiles.'
              )}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <IconCheck size={18} className="mt-0.5 shrink-0 text-vetro" />
            <span>
              Envío gratis desde {formatARS(site.comercial.envioGratisDesde)} o retiro en tu óptica socia.
            </span>
          </li>
        </ul>

        <div className="mt-6">
          <Disclosure
            summary={<Titulo icono={<IconPercent />}>Promociones</Titulo>}
            defaultOpen
            className="border-b-0 bg-sol/15 px-4"
          >
            <ul className="list-disc space-y-2 pb-3 pl-5 text-sm">
              {nCuotas > 1 && (
                <li>
                  <strong className="font-semibold">{nCuotas} cuotas sin interés</strong> de{' '}
                  {formatARS(cuotas(producto.precio, nCuotas).valor)} con tarjetas bancarias.
                </li>
              )}
              {descuentoTransferencia > 0 && (
                <li>
                  <strong className="font-semibold">{descuentoTransferencia}% de descuento</strong> pagando por
                  transferencia.
                </li>
              )}
              <li>Envío gratis desde {formatARS(site.comercial.envioGratisDesde)}.</li>
              <li>Ajuste gratis en tu óptica socia, todas las veces que necesites.</li>
            </ul>
          </Disclosure>

          <Disclosure summary={<Titulo icono={<IconList />}>Características</Titulo>}>
            {producto.descripcion && <p className="whitespace-pre-line pb-3 text-sm">{producto.descripcion}</p>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 pb-3 text-sm">
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
              {variante && (
                <>
                  <dt className="text-gris-texto">Color del armazón</dt>
                  <dd>{variante.colorArmazon}</dd>
                </>
              )}
              {variante?.colorLente && (
                <>
                  <dt className="text-gris-texto">Lente</dt>
                  <dd>{variante.colorLente}</dd>
                </>
              )}
              {producto.linea === 'SOL' && (
                <>
                  <dt className="text-gris-texto">Protección</dt>
                  <dd>UV400 (100% UVA y UVB)</dd>
                </>
              )}
              {variante && (
                <>
                  <dt className="text-gris-texto">SKU</dt>
                  <dd>{variante.sku}</dd>
                </>
              )}
            </dl>
          </Disclosure>

          {tieneMedidas && (
            <Disclosure summary={<Titulo icono={<IconRuler size={18} />}>Medidas</Titulo>}>
              <dl className="grid grid-cols-3 gap-px bg-negro/10 text-center">
                {[
                  ['Calibre', calibreMm],
                  ['Puente', puenteMm],
                  ['Varilla', varillaMm],
                ].map(([k, v]) => (
                  <div key={String(k)} className="bg-blanco p-3">
                    <dt className="text-[11px] uppercase tracking-wider text-gris-texto">{k}</dt>
                    <dd className="text-lg font-semibold">{v ? `${v} mm` : '—'}</dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                onClick={() => setGuia(true)}
                className="mb-3 mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm underline underline-offset-4"
              >
                <IconRuler size={18} /> Guía de talles: ¿cómo sé si me queda?
              </button>
            </Disclosure>
          )}

          <Disclosure summary={<Titulo icono={<IconCheck size={18} />}>Garantía y cambios</Titulo>}>
            <ul className="list-disc space-y-1 pb-3 pl-5 text-sm">
              <li>Garantía de fábrica contra defectos de materiales y armado.</li>
              <li>
                Cambios y devoluciones dentro de los {site.comercial.diasCambio} días de recibido, con el
                producto sin uso.{' '}
                <Link href="/cambios-y-devoluciones" className="underline underline-offset-4">
                  Ver condiciones
                </Link>
                .
              </li>
              <li>Los lentes recetados se arman a medida: sólo se cambian por defecto de fabricación.</li>
            </ul>
          </Disclosure>

          <Disclosure summary={<Titulo icono={<IconTruck size={18} />}>Condiciones de envío</Titulo>}>
            <ul className="list-disc space-y-1 pb-3 pl-5 text-sm">
              <li>Retiro gratis en tu óptica socia, listo para usar y ajustado a tu cara.</li>
              <li>
                Envío a domicilio a todo el país. Gratis desde {formatARS(site.comercial.envioGratisDesde)}
                {comercial.costoEnvio > 0 ? `; si no, ${formatARS(comercial.costoEnvio)}` : ''}.
              </li>
              <li>Anteojos de sol y accesorios: 3 a 5 días hábiles.</li>
              <li>Recetados y multifocales: la óptica arma los lentes; 5 a 10 días hábiles.</li>
              <li>Seguimiento del pedido desde Mi cuenta.</li>
            </ul>
          </Disclosure>

          <Disclosure summary={<Titulo icono={<IconCard />}>Métodos de pago</Titulo>}>
            <ul className="list-disc space-y-1 pb-3 pl-5 text-sm">
              {comercial.mercadoPago && (
                <li>
                  Mercado Pago: tarjetas de crédito y débito
                  {nCuotas > 1 ? ` en hasta ${nCuotas} cuotas sin interés` : ''}
                  {comercial.mercadoPagoBilletera ? ', saldo en cuenta o QR' : ''}.
                </li>
              )}
              {!comercial.mercadoPago && nCuotas > 1 && (
                <li>Tarjetas de crédito en hasta {nCuotas} cuotas sin interés.</li>
              )}
              {comercial.transferencia && (
                <li>
                  Transferencia bancaria
                  {descuentoTransferencia > 0 ? ` con ${descuentoTransferencia}% de descuento` : ''}; te
                  reservamos el stock {comercial.transferencia.horasReserva} h.
                </li>
              )}
            </ul>
          </Disclosure>
        </div>
      </div>

      <GuiaTalles open={guia} onClose={() => setGuia(false)} medidas={producto.medidas} />
    </div>
  );
}
