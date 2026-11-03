import { cn } from './cn';

export interface ColorDot {
  nombre: string;
  hex: string | null;
}

const FALLBACK = '#8A8A86';

/** Puntos de color (sólo visuales) con la lista de colores como texto accesible. */
export function ColorDots({
  colores,
  max = 5,
  className,
  size = 'sm',
}: {
  colores: ColorDot[];
  max?: number;
  className?: string;
  size?: 'sm' | 'md';
}) {
  if (colores.length === 0) return null;
  const visibles = colores.slice(0, max);
  const resto = colores.length - visibles.length;
  const dot = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="sr-only">
        {colores.length === 1 ? 'Color: ' : 'Colores: '}
        {colores.map((c) => c.nombre).join(', ')}
      </span>
      {visibles.map((c) => (
        <span
          key={c.nombre}
          aria-hidden="true"
          className={cn('inline-block rounded-full border border-negro/15', dot)}
          style={{ backgroundColor: c.hex ?? FALLBACK }}
        />
      ))}
      {resto > 0 && (
        <span aria-hidden="true" className="text-[11px] leading-none text-gris-texto">
          +{resto}
        </span>
      )}
    </span>
  );
}

export interface ColorSwatchOption {
  id: string;
  nombre: string;
  hex: string | null;
  disponible: boolean;
}

/** Selector de color accesible (radiogroup). */
export function ColorSwatches({
  opciones,
  value,
  onChange,
  label = 'Color',
}: {
  opciones: ColorSwatchOption[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const actual = opciones.find((o) => o.id === value);
  return (
    <fieldset className="min-w-0">
      <legend className="font-text mb-2 text-sm text-negro">
        {label}: <span className="font-medium">{actual?.nombre ?? '—'}</span>
        {actual && !actual.disponible && <span className="text-gris-texto"> · sin stock</span>}
      </legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {opciones.map((o) => {
          const selected = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={o.disponible ? o.nombre : `${o.nombre} (sin stock)`}
              title={o.nombre}
              onClick={() => onChange(o.id)}
              className={cn(
                'relative inline-flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche focus-visible:ring-offset-2',
                selected ? 'border-negro' : 'border-transparent hover:border-negro/40',
              )}
            >
              <span
                aria-hidden="true"
                className="h-8 w-8 rounded-full border border-negro/15"
                style={{ backgroundColor: o.hex ?? FALLBACK }}
              />
              {!o.disponible && (
                <span
                  aria-hidden="true"
                  className="absolute h-[2px] w-9 rotate-45 bg-negro/70"
                />
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
