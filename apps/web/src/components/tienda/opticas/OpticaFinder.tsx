'use client';
// Buscador de óptica socia por código postal (y "usar mi ubicación" si el navegador lo permite).
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Button, IconPin, IconWhatsApp, cn } from '@vedere/ui';
import { whatsappLink } from '@/config/site';
import { tiendaApi, mensajeError } from '@/lib/tienda/client';
import type { Optica } from '@/lib/tienda/types';

export function OpticaCard({ optica, compacto }: { optica: Optica; compacto?: boolean }) {
  const wa = optica.whatsapp ? whatsappLink('Hola, vengo de Vedere', optica.whatsapp) : null;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${optica.direccion}, ${optica.localidad}`,
  )}`;
  return (
    <article className="font-text rounded-2xl border border-negro/10 bg-blanco p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{optica.nombre}</h3>
          <p className="text-sm text-gris-texto">
            {optica.direccion} · {optica.localidad}
            {!compacto && `, ${optica.provincia}`} · CP {optica.codigoPostal}
          </p>
        </div>
        {optica.distanciaKm !== null && optica.distanciaKm !== undefined && (
          <span className="shrink-0 rounded-full bg-gris-claro px-2.5 py-1 text-xs font-medium">
            {optica.distanciaKm} km
          </span>
        )}
      </div>
      {optica.horarios && <p className="mt-1 text-sm text-gris-texto">{optica.horarios}</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <a
          href={maps}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-1 rounded-full border border-negro/15 px-3 hover:border-negro"
        >
          <IconPin size={16} /> Cómo llegar
        </a>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1 rounded-full border border-negro/15 px-3 hover:border-negro"
          >
            <IconWhatsApp size={16} /> WhatsApp
          </a>
        )}
        {optica.telefono && (
          <a
            href={`tel:${optica.telefono.replace(/\s/g, '')}`}
            className="inline-flex h-10 items-center rounded-full border border-negro/15 px-3 hover:border-negro"
          >
            Llamar
          </a>
        )}
      </div>
    </article>
  );
}

export function OpticaFinder({
  compacto,
  onResultados,
  className,
}: {
  compacto?: boolean;
  onResultados?: (items: Optica[]) => void;
  className?: string;
}) {
  const [cp, setCp] = useState('');
  const [items, setItems] = useState<Optica[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscar(query: string) {
    setCargando(true);
    setError(null);
    try {
      const res = await tiendaApi.get<{ items: Optica[] }>(`/catalogo/opticas${query}`);
      const lista = compacto ? res.items.slice(0, 3) : res.items;
      setItems(lista);
      onResultados?.(res.items);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const limpio = cp.replace(/\D/g, '').slice(0, 4);
    if (limpio.length < 4) {
      setError('Ingresá un código postal de 4 cifras (ej. 1425).');
      return;
    }
    void buscar(`?cp=${limpio}`);
  }

  function usarUbicacion() {
    if (!('geolocation' in navigator)) {
      setError('Tu navegador no permite usar la ubicación.');
      return;
    }
    setCargando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => void buscar(`?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`),
      () => {
        setCargando(false);
        setError('No pudimos acceder a tu ubicación. Probá con el código postal.');
      },
      { timeout: 8000 },
    );
  }

  return (
    <div className={cn('font-text', className)}>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="cp-finder" className="sr-only">
          Código postal
        </label>
        <input
          id="cp-finder"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          placeholder="Código postal (ej. 1425)"
          value={cp}
          onChange={(e) => setCp(e.target.value.replace(/\D/g, ''))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'cp-error' : undefined}
          className="h-12 min-w-0 flex-1 rounded-full border border-negro/15 bg-blanco px-5 text-base placeholder:text-gris-texto focus:border-negro focus:outline-none"
        />
        <Button type="submit" loading={cargando}>
          Buscar
        </Button>
      </form>
      <button
        type="button"
        onClick={usarUbicacion}
        className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm underline-offset-4 hover:underline"
      >
        <IconPin size={16} /> Usar mi ubicación
      </button>
      {error && (
        <p id="cp-error" role="alert" className="mt-2 text-sm text-carey">
          {error}
        </p>
      )}
      {items && (
        <div className="mt-4 space-y-3" aria-live="polite">
          {items.length === 0 ? (
            <p className="text-sm text-gris-texto">
              Todavía no tenemos ópticas socias en tu zona. Igual te enviamos a domicilio.
            </p>
          ) : (
            <>
              <p className="text-sm text-gris-texto">
                {compacto ? 'Las más cercanas a tu zona:' : `${items.length} ópticas`}
              </p>
              <ul className="space-y-3">
                {items.map((o) => (
                  <li key={o.id}>
                    <OpticaCard optica={o} compacto={compacto} />
                  </li>
                ))}
              </ul>
              {compacto && (
                <Link href="/opticas" className="inline-block text-sm font-medium underline-offset-4 hover:underline">
                  Ver todas las ópticas socias
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
