'use client';
// Piezas chicas compartidas por el catálogo, la ficha y el carrito mayorista.
import { cn } from '@vedere/ui';

/** Stock disponible de una variante; con 0 se muestra "Consultar" (no se puede pedir). */
export function StockLabel({ disponible }: { disponible: number }) {
  if (disponible <= 0) {
    return (
      <span className="whitespace-nowrap text-xs font-medium text-carey" title="Sin stock: consultá a Vedere por reposición">
        Consultar
      </span>
    );
  }
  return (
    <span className={cn('whitespace-nowrap text-xs', disponible <= 3 ? 'font-medium text-[#9a6b00]' : 'text-gris-medio')}>
      {disponible} disp.
    </span>
  );
}

/** Campo de cantidad compacto (0 = no se agrega). Limita al stock disponible. */
export function CantidadInput({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (c: number) => void;
  label: string;
}) {
  const sinStock = max <= 0;
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={Math.max(0, max)}
      step={1}
      disabled={sinStock}
      aria-label={label}
      value={value === 0 ? '' : value}
      placeholder={sinStock ? '—' : '0'}
      onChange={(e) => {
        const n = Math.floor(Number(e.target.value));
        onChange(Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0);
      }}
      className="h-9 w-16 rounded-lg border border-negro/20 bg-blanco px-2 text-right text-sm tabular-nums focus:border-negro focus:outline-none focus:ring-1 focus:ring-negro disabled:bg-gris-claro"
    />
  );
}
