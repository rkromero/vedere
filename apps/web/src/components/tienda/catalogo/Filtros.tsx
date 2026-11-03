'use client';
// Panel de filtros: barra lateral en desktop y cajón en celular. Los cambios se escriben en la URL.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Disclosure, Drawer, IconFilter, cn } from '@vedere/ui';
import { LABELS } from '@/lib/format';
import type { Forma, Genero, Linea, Material } from '@/lib/format';
import { chipsActivos, limpiarFiltros, urlQuery } from '@/lib/tienda/filtros';
import type { FiltrosActivos } from '@/lib/tienda/filtros';
import type { Filtros as FiltrosDisponibles } from '@/lib/tienda/types';

interface Props {
  disponibles: FiltrosDisponibles;
  activos: FiltrosActivos;
  basePath: string;
  mostrarLinea: boolean;
  modo: 'sidebar' | 'drawer';
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
        <Disclosure summary="Forma" defaultOpen>
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
        <Disclosure summary="Color" defaultOpen>
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
        <Disclosure summary="Material">
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
        <Disclosure summary="Línea">
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
        <Disclosure summary="Género">
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
      <Disclosure summary="Precio">
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
              className="mt-1 h-11 w-full rounded-xl border border-negro/15 px-3 text-base text-negro focus:border-negro focus:outline-none"
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
              className="mt-1 h-11 w-full rounded-xl border border-negro/15 px-3 text-base text-negro focus:border-negro focus:outline-none"
            />
          </label>
        </div>
      </Disclosure>
    </div>
  );
}

export function Filtros({ disponibles, activos, basePath, mostrarLinea, modo }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FiltrosActivos>(activos);
  useEffect(() => setDraft(activos), [activos]);

  const cantidad = chipsActivos(activos, mostrarLinea).length;
  const aplicar = (f: FiltrosActivos) => {
    router.push(`${basePath}${urlQuery(f)}`, { scroll: false });
  };

  if (modo === 'sidebar') {
    // En desktop cada cambio se aplica al instante.
    return (
      <aside className="hidden lg:block" aria-label="Filtros">
        <div className="sticky top-24">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-text text-base font-semibold">Filtros</h2>
            {cantidad > 0 && (
              <button
                type="button"
                onClick={() => aplicar(limpiarFiltros(activos))}
                className="font-text text-sm underline underline-offset-4"
              >
                Limpiar
              </button>
            )}
          </div>
          <Panel
            disponibles={disponibles}
            draft={draft}
            setDraft={(f) => {
              setDraft(f);
              aplicar(f);
            }}
            mostrarLinea={mostrarLinea}
          />
        </div>
      </aside>
    );
  }

  return (
    <div className="lg:hidden">
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="h-11">
        <IconFilter size={18} />
        Filtros
        {cantidad > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-negro px-1 text-[11px] text-blanco">
            {cantidad}
          </span>
        )}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Filtros"
        side="right"
        footer={
          <div className={cn('flex gap-2')}>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setDraft(limpiarFiltros(draft));
              }}
            >
              Limpiar
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                aplicar(draft);
                setOpen(false);
              }}
            >
              Ver resultados
            </Button>
          </div>
        }
      >
        <Panel
          disponibles={disponibles}
          draft={draft}
          setDraft={setDraft}
          mostrarLinea={mostrarLinea}
        />
      </Drawer>
    </div>
  );
}
