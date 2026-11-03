import { cn } from './cn';

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

/** Formato determinístico de pesos argentinos sin decimales ("$ 89.900"). */
export function formatARS(value: number): string {
  return ars.format(Math.round(value));
}

/** Cuotas sin interés: cantidad y valor por cuota (redondeado hacia arriba). */
export function cuotas(precio: number, cantidad: number) {
  const valor = Math.ceil(precio / cantidad);
  return { cantidad, valor, texto: `${cantidad} cuotas sin interés de ${formatARS(valor)}` };
}

export interface PriceProps {
  precio: number;
  precioLista?: number | null;
  /** Cantidad de cuotas sin interés a mostrar (0 oculta la línea). */
  cuotas?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Oculta la línea de cuotas (la tarjeta compacta). */
  sinCuotas?: boolean;
}

/** Precio final siempre visible; precio de lista tachado y % de descuento si corresponde. */
export function Price({
  precio,
  precioLista,
  cuotas: nCuotas = 6,
  size = 'md',
  className,
  sinCuotas,
}: PriceProps) {
  const tieneDescuento = !!precioLista && precioLista > precio;
  const off = tieneDescuento ? Math.round((1 - precio / precioLista!) * 100) : 0;
  const sizes = {
    sm: { precio: 'text-sm', lista: 'text-xs', cuotas: 'text-xs' },
    md: { precio: 'text-base', lista: 'text-sm', cuotas: 'text-sm' },
    lg: { precio: 'text-2xl', lista: 'text-base', cuotas: 'text-base' },
  }[size];
  return (
    <div className={cn('font-text', className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn('font-semibold text-negro', sizes.precio)}>{formatARS(precio)}</span>
        {tieneDescuento && (
          <>
            <s className={cn('text-gris-texto', sizes.lista)}>{formatARS(precioLista!)}</s>
            <span className={cn('font-medium text-noche', sizes.lista)}>{off}% OFF</span>
          </>
        )}
      </p>
      {!sinCuotas && nCuotas > 0 && (
        <p className={cn('text-gris-texto', sizes.cuotas)}>{cuotas(precio, nCuotas).texto}</p>
      )}
    </div>
  );
}
