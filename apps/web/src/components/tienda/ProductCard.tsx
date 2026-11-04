'use client';
// Tarjeta de producto estilo Hawkers: foto 5:4 sobre gris claro sin esquinas redondeadas, flechas al
// pasar el mouse para recorrer las fotos del color, botón "+" que agrega al carrito sin salir del
// listado, etiqueta en mayúsculas abajo a la izquierda y precio con descuento en rojo.
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { IconCheck, IconChevronLeft, IconChevronRight, IconPlus, cn, cuotas, formatARS } from '@vedere/ui';
import { useCuotas } from '@/lib/tienda/comercial';
import { useCart } from '@/lib/tienda/cart';
import type { Producto } from '@/lib/types';
import { altProducto, urlProducto, varianteInicial } from '@/lib/tienda/producto';
import { FavoritoButton } from '@/components/tienda/cuenta/FavoritoButton';

export function ProductCard({
  producto,
  priority,
  sizes = '(min-width: 1024px) 25vw, 50vw',
  className,
}: {
  producto: Producto;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const nCuotas = useCuotas(producto.linea);
  const { agregar } = useCart();
  const variante = varianteInicial(producto);
  const fotos = (variante?.imagenes.length ? variante.imagenes : producto.variantes.flatMap((v) => v.imagenes)).map(
    (i) => ({ src: i.urlMediana ?? i.url, alt: i.alt }),
  );
  const [foto, setFoto] = useState(0);
  const [agregado, setAgregado] = useState(false);
  const agotado = producto.stockTotal <= 0 || !variante || variante.stock <= 0;
  const descuentoPct =
    producto.precioLista && producto.precioLista > producto.precio
      ? Math.round((1 - producto.precio / producto.precioLista) * 100)
      : 0;
  const nColores = producto.variantes.length;
  const href = urlProducto(producto, variante);
  const actual = fotos[foto] ?? fotos[0];

  const etiqueta = agotado
    ? 'Sin stock'
    : producto.edicionLimitada
      ? 'Edición limitada'
      : producto.nuevo
        ? 'Nuevo'
        : producto.destacado
          ? 'Más vendido'
          : null;

  function mover(e: React.MouseEvent, delta: number) {
    e.preventDefault();
    e.stopPropagation();
    setFoto((i) => (i + delta + fotos.length) % fotos.length);
  }

  function onAgregar(e: React.MouseEvent) {
    e.preventDefault();
    if (agotado || !variante) return;
    agregar(producto, variante);
    setAgregado(true);
    window.setTimeout(() => setAgregado(false), 1800);
  }

  return (
    <article className={cn('group relative flex flex-col bg-blanco', className)} data-testid="product-card">
      <div className="relative aspect-[5/4] overflow-hidden bg-gris-claro">
        <Link
          href={href}
          className="absolute inset-0 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-noche"
          aria-label={`${producto.nombre}, ${formatARS(producto.precio)}`}
        >
          {actual ? (
            <Image
              key={actual.src}
              src={actual.src}
              alt={altProducto(producto, variante, actual.alt)}
              fill
              sizes={sizes}
              priority={priority}
              className="img-producto transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-sm text-gris-texto">
              Sin foto
            </span>
          )}
        </Link>

        {fotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => mover(e, -1)}
              aria-label="Foto anterior"
              className="absolute left-1 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center bg-blanco/80 text-negro opacity-0 transition-opacity hover:bg-blanco focus-visible:opacity-100 group-hover:opacity-100 md:inline-flex"
            >
              <IconChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={(e) => mover(e, 1)}
              aria-label="Foto siguiente"
              className="absolute right-1 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center bg-blanco/80 text-negro opacity-0 transition-opacity hover:bg-blanco focus-visible:opacity-100 group-hover:opacity-100 md:inline-flex"
            >
              <IconChevronRight size={20} />
            </button>
          </>
        )}

        {etiqueta && (
          <span
            className={cn(
              'pointer-events-none absolute bottom-2 left-2 bg-blanco/85 px-1.5 py-0.5 font-text text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-[11px]',
              agotado ? 'text-carey' : 'text-negro',
            )}
          >
            {etiqueta}
          </span>
        )}

        <button
          type="button"
          onClick={onAgregar}
          disabled={agotado}
          aria-label={agotado ? 'Sin stock' : `Agregar ${producto.nombre} al carrito`}
          data-testid="card-add"
          className="absolute bottom-0 right-0 inline-flex h-10 w-10 items-center justify-center bg-blanco text-negro transition-colors hover:bg-negro hover:text-blanco disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-blanco disabled:hover:text-negro"
        >
          {agregado ? <IconCheck size={18} /> : <IconPlus size={18} />}
        </button>

        <FavoritoButton
          productoId={producto.id}
          size="sm"
          className="absolute right-1 top-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-within:opacity-100"
        />
      </div>

      <div className="font-text flex flex-col gap-0.5 px-3 pb-4 pt-3">
        <h3 className="text-[11px] font-medium uppercase leading-snug tracking-[0.08em] text-negro/75 sm:text-xs">
          <Link href={href} className="hover:text-negro">
            {producto.nombre}
            {variante ? ` - ${variante.colorArmazon}` : ''}
          </Link>
        </h3>
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          {descuentoPct > 0 && (
            <s className="text-xs text-gris-texto">{formatARS(producto.precioLista!)}</s>
          )}
          <span className={cn('font-semibold', descuentoPct > 0 ? 'text-[#e4002b]' : 'text-negro')}>
            {formatARS(producto.precio)}
          </span>
          {descuentoPct > 0 && <span className="text-xs font-semibold text-[#e4002b]">-{descuentoPct}%</span>}
        </p>
        {nColores > 1 && (
          <p className="text-xs text-gris-texto">
            {nColores} colores
          </p>
        )}
        {nCuotas > 1 && (
          <p className="text-[11px] text-gris-texto">{cuotas(producto.precio, nCuotas).texto}</p>
        )}
      </div>
    </article>
  );
}
