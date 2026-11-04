'use client';
// Cajón "Filtrar y ordenar" (estilo Hawkers) en todos los tamaños de pantalla. Los cambios se arman en
// un borrador, se cuenta cuántos resultados darían y se aplican a la URL al tocar "Ver N resultados".
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Disclosure, Drawer, IconChevronDown, cn } from '@vedere/ui';
import { LABELS } from '@/lib/format';
import type { Forma, Genero, Linea, Material } from '@/lib/format';
import { ORDENES, apiQuery, limpiarFiltros, urlQuery } from '@/lib/tienda/filtros';
import type { ContextoListado, FiltrosActivos, Orden } from '@/lib/tienda/filtros';
import { tiendaApi } from '@/lib/tienda/client';
import type { Paged, Producto } from '@/lib/types';
import type { Filtros as FiltrosDisponibles } from '@/lib/tienda/types';

interface Props {
  open: boolean;
  onClose: () => void;
  disponibles: FiltrosDisponibles;
  activos: FiltrosActivos;
  basePath: string;
  ctx: ContextoListado;
  mostrarLinea: boolean;
  totalActual: number;
}

function Opcion({
  checked,
  onChange,
  label,
  cantidad,
  hex,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  cantidad?: number;
  hex?: string | null;
}) {
  return (
    <label className="font-text flex min-h-10 cursor-pointer items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 rounded border-negro/30 accent-negro"
      />
      {hex !== undefined && (
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 shrink-0 rounded-full border border-negro/15"
          style={{ backgroundColor: hex ?? '#8A8A86' }}
        />
      )}
      <span className="flex-1">{label}</span>
      {cantidad !== undefined && <span className="text-xs text-gris-texto">{cantidad}</span>}
    </label>
  );
}

const T = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs font-semibold uppercase tracking-wider">{children}</span>
);

function toggle<T>(list: T[], v: T, on: boolean): T[] {
  return on ? Array.from(new Set([...list, v])) : list.filter((x) => x !== v);
}

function Panel({
  disponibles,
  draft,
  setDraft,
  mostrarLinea,
}: {
  disponibles: FiltrosDisponibles;
  draft: FiltrosActivos;
  setDraft: (f: FiltrosActivos) => void;
  mostrarLinea: boolean;
}) {
  const set = (p: Partial<FiltrosActivos>) => setDraft({ ...draft, ...p, page: 1 });
  return (
    <div className="font-text">
      {disponibles.formas.length > 0 && (
        <Disclosure summary={<T>Forma</T>} defaultOpen>
          {disponibles.formas.map((o) => (
            <Opcion
              key={o.valor}
              label={LABELS.forma[o.valor]}
              cantidad={o.cantidad}
              checked={draft.forma.includes(o.valor)}
              onChange={(on) => set({ forma: toggle<Forma>(draft.forma, o.valor, on) })}
            />
          ))}
        </Disclosure>
      )}
      {disponibles.colores.length > 0 && (
        <Disclosure summary={<T>Color</T>}>
          {disponibles.colores.map((o) => (
            <Opcion
              key={o.valor}
              label={o.valor}
              hex={o.hex}
              cantidad={o.cantidad}
              checked={draft.color.includes(o.valor)}
              onChange={(on) => set({ color: toggle(draft.color, o.valor, on) })}
            />
          ))}
        </Disclosure>
      )}
      {disponibles.materiales.length > 0 && (
        <Disclosure summary={<T>Material</T>}>
          {disponibles.materiales.map((o) => (
            <Opcion
              key={o.valor}
              label={LABELS.material[o.valor]}
              cantidad={o.cantidad}
              checked={draft.material.includes(o.valor)}
              onChange={(on) => set({ material: toggle<Material>(draft.material, o.valor, on) })}
            />
          ))}
        </Disclosure>
      )}
      {mostrarLinea && disponibles.lineas.length > 0 && (
        <Disclosure summary={<T>Línea</T>}>
          {disponibles.lineas.map((o) => (
            <Opcion
              key={o.valor}
              label={LABELS.linea[o.valor]}
              cantidad={o.cantidad}
              checked={draft.linea.includes(o.valor)}
              onChange={(on) => set({ linea: toggle<Linea>(draft.linea, o.valor, on) })}
            />
          ))}
        </Disclosure>
      )}
      {disponibles.generos.length > 1 && (
        <Disclosure summary={<T>Género</T>}>
          {disponibles.generos.map((o) => (
            <Opcion
              key={o.valor}
              label={LABELS.genero[o.valor]}
              cantidad={o.cantidad}
              checked={draft.genero.includes(o.valor)}
              onChange={(on) => set({ genero: toggle<Genero>(draft.genero, o.valor, on) })}
            />
          ))}
        </Disclosure>
      )}
      <Disclosure summary={<T>Precio</T>}>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-gris-texto">
            Desde
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder={String(disponibles.precio.min)}
              value={draft.precioMin ?? ''}
              onChange={(e) =>
                set({ precioMin: e.target.value === '' ? null : Number(e.target.value) })
              }
              className="mt-1 h-11 w-full border border-negro/15 px-3 text-base text-negro focus:border-negro focus:outline-none"
            />
          </label>
          <label className="text-xs text-gris-texto">
            Hasta
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder={String(disponibles.precio.max)}
              value={draft.precioMax ?? ''}
              onChange={(e) =>
                set({ precioMax: e.target.value === '' ? null : Number(e.target.value) })
              }
              className="mt-1 h-11 w-full border border-negro/15 px-3 text-base text-negro focus:border-negro focus:outline-none"
            />
          </label>
        </div>
      </Disclosure>
    </div>
  );
}

export function FiltrosDrawer({
  open,
  onClose,
  disponibles,
  activos,
  basePath,
  ctx,
  mostrarLinea,
  totalActual,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<FiltrosActivos>(activos);
  const [total, setTotal] = useState<number>(totalActual);
  const [contando, setContando] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(activos);
      setTotal(totalActual);
    }
  }, [open, activos, totalActual]);

  // Cuántos resultados daría el borrador (con un pequeño debounce).
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setContando(true);
    const t = window.setTimeout(async () => {
      try {
        const q = apiQuery(draft, ctx, 1).replace(/pageSize=\d+/, 'pageSize=1');
        const res = await tiendaApi.get<Paged<Producto>>(`/catalogo/productos${q}`);
        if (vivo) setTotal(res.total);
      } catch {
        /* se mantiene el último número */
      } finally {
        if (vivo) setContando(false);
      }
    }, 250);
    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
  }, [draft, ctx, open]);

  function aplicar() {
    router.push(`${basePath}${urlQuery({ ...draft, page: 1 })}`, { scroll: false });
    onClose();
  }

  return (
    <Drawer open={open} onClose={onClose} title="Filtrar y ordenar" side="right" className="sm:rounded-none!">
      <div className="font-text -mt-1 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDraft(limpiarFiltros(draft))}
          className="h-12 border border-negro text-xs font-semibold uppercase tracking-wider hover:bg-negro hover:text-blanco"
        >
          Eliminar filtros
        </button>
        <button
          type="button"
          onClick={aplicar}
          data-testid="filtros-aplicar"
          className={cn(
            'h-12 bg-negro text-xs font-semibold uppercase tracking-wider text-blanco hover:bg-negro/85',
            contando && 'opacity-70',
          )}
        >
          Ver {total} {total === 1 ? 'resultado' : 'resultados'}
        </button>
      </div>

      {!ctx.orden && (
        <div className="font-text relative mt-5">
          <label htmlFor="orden-drawer" className="text-xs font-semibold uppercase tracking-wider">
            Ordenar por
          </label>
          <select
            id="orden-drawer"
            value={draft.orden}
            onChange={(e) => setDraft({ ...draft, orden: e.target.value as Orden, page: 1 })}
            className="mt-2 h-12 w-full appearance-none border border-negro/20 bg-blanco pl-3 pr-9 text-sm focus:border-negro focus:outline-none"
          >
            {ORDENES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <IconChevronDown size={16} className="pointer-events-none absolute bottom-4 right-3" />
        </div>
      )}

      <div className="mt-4">
        <Panel disponibles={disponibles} draft={draft} setDraft={setDraft} mostrarLinea={mostrarLinea} />
      </div>
    </Drawer>
  );
}
