'use client';
// Tarjeta de producto: foto grande (segunda imagen al pasar el mouse), etiquetas, puntos de color,
// precio y cuotas (según la línea, desde la configuración comercial). Sin estado; el hover es CSS.
import Image from 'next/image';
import Link from 'next/link';
import { ColorDots, Price, Tag, cn } from '@vedere/ui';
import { useCuotas } from '@/lib/tienda/comercial';
import type { Producto } from '@/lib/types';
import { altProducto, imagenesTarjeta, urlProducto, varianteInicial } from '@/lib/tienda/producto';

export function ProductCard({
  producto,
  priority,
  sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw',
  className,
}: {
  producto: Producto;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const nCuotas = useCuotas(producto.linea);
  const variante = varianteInicial(producto);
  const { principal, segunda } = imagenesTarjeta(producto, variante);
  const agotado = producto.stockTotal <= 0;
  const colores = producto.variantes.map((v) => ({ nombre: v.colorArmazon, hex: v.colorArmazonHex }));

  return (
    <article className={cn('group relative flex flex-col', className)}>
      <Link
        href={urlProducto(producto, variante)}
        className="relative block aspect-square overflow-hidden rounded-2xl bg-gris-claro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche focus-visible:ring-offset-2"
        aria-label={`${producto.nombre}, ${producto.precio.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}`}
      >
        {principal ? (
          <Image
            src={principal.src}
            alt={altProducto(producto, variante, principal.alt)}
            fill
            sizes={sizes}
            priority={priority}
            className={cn(
              'img-producto transition-opacity duration-300',
              segunda && 'group-hover:opacity-0 group-focus-within:opacity-0',
            )}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-gris-texto">
            Sin foto
          </span>
        )}
        {segunda && (
          <Image
            src={segunda.src}
            alt=""
            fill
            sizes={sizes}
            className="img-producto opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
          />
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          {producto.nuevo && <Tag tone="blanco">Nuevo</Tag>}
          {producto.edicionLimitada && <Tag tone="negro">Edición limitada</Tag>}
          {agotado && <Tag tone="carey">Sin stock</Tag>}
        </div>
      </Link>

      <div className="font-text mt-3 flex flex-col gap-1 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-snug sm:text-base">
            <Link href={urlProducto(producto, variante)} className="hover:underline underline-offset-4">
              {producto.nombre}
            </Link>
          </h3>
          <ColorDots colores={colores} className="mt-1 shrink-0" />
        </div>
        <Price
          precio={producto.precio}
          precioLista={producto.precioLista}
          cuotas={nCuotas}
          size="sm"
        />
      </div>
    </article>
  );
}
