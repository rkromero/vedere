'use client';
// Página de ópticas: buscador por CP, listado por provincia y mapa (carga diferida).
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@vedere/ui';
import type { Optica } from '@/lib/tienda/types';
import { OpticaCard, OpticaFinder } from './OpticaFinder';

const OpticasMapa = dynamic(() => import('./OpticasMapa').then((m) => m.OpticasMapa), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full md:h-[28rem] lg:h-[36rem]" />,
});

export function OpticasExplorer({ opticas }: { opticas: Optica[] }) {
  const [resultados, setResultados] = useState<Optica[] | null>(null);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  // El mapa (Leaflet + tiles) se monta recién cuando se acerca al viewport.
  const mapaRef = useRef<HTMLDivElement>(null);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  useEffect(() => {
    const el = mapaRef.current;
    if (!el || mostrarMapa) return;
    if (!('IntersectionObserver' in window)) {
      setMostrarMapa(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setMostrarMapa(true);
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mostrarMapa]);

  const porProvincia = useMemo(() => {
    const lista = resultados ?? opticas;
    const grupos = new Map<string, Optica[]>();
    for (const o of lista) {
      const g = grupos.get(o.provincia) ?? [];
      g.push(o);
      grupos.set(o.provincia, g);
    }
    return resultados ? [['Más cercanas', lista] as const] : Array.from(grupos.entries());
  }, [opticas, resultados]);

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
      <div>
        <OpticaFinder onResultados={(items) => setResultados(items)} />
        {resultados && (
          <button
            type="button"
            onClick={() => setResultados(null)}
            className="font-text mt-3 text-sm underline underline-offset-4"
          >
            Ver todas
          </button>
        )}
        <div className="mt-6 space-y-6">
          {porProvincia.map(([provincia, lista]) => (
            <section key={provincia} aria-labelledby={`prov-${provincia}`}>
              <h2 id={`prov-${provincia}`} className="font-text mb-3 text-lg font-semibold">
                {provincia}{' '}
                <span className="text-sm font-normal text-gris-texto">({lista.length})</span>
              </h2>
              <ul className="space-y-3">
                {lista.map((o) => (
                  <li
                    key={o.id}
                    onClick={() => setSeleccionada(o.id)}
                    className={seleccionada === o.id ? 'rounded-2xl ring-2 ring-negro' : ''}
                  >
                    <OpticaCard optica={o} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <div ref={mapaRef} className="lg:sticky lg:top-24 lg:self-start">
        {mostrarMapa ? (
          <OpticasMapa
            opticas={opticas}
            seleccionada={seleccionada}
            onSeleccionar={setSeleccionada}
          />
        ) : (
          <Skeleton className="h-72 w-full md:h-[28rem] lg:h-[36rem]" />
        )}
      </div>
    </div>
  );
}
