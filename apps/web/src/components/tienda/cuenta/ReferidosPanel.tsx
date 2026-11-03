'use client';
// Referidos: link único (copiar / compartir), amigos referidos y cupones obtenidos.
import { useState } from 'react';
import { Button } from '@vedere/ui';
import { formatFecha, formatPrecio } from '@/lib/format';
import type { Referidos } from '@/lib/tienda/cuenta';
import { Pastilla, SinDatos, Tarjeta } from './Tarjeta';

export function ReferidosPanel({ data }: { data: Referidos | null }) {
  const [copiado, setCopiado] = useState(false);
  const pct = data?.descuentoPct ?? 10;

  async function copiar() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt('Copiá tu link:', data.link);
    }
  }

  const puedeCompartir = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  async function compartir() {
    if (!data) return;
    try {
      await navigator.share({
        title: 'Vedere',
        text: `Comprá tus anteojos en Vedere con mi link y los dos tenemos ${pct}% de descuento.`,
        url: data.link,
      });
    } catch {
      /* cancelado */
    }
  }

  return (
    <div className="space-y-6">
      <Tarjeta titulo="Tu link de referidos">
        <p className="text-sm text-negro/80">
          Compartilo con quien quieras: cuando un amigo se registra con tu link y hace su primera compra,{' '}
          <strong>los dos reciben un cupón de {pct}% de descuento</strong> para la próxima.
        </p>
        {data ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={data.link}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Tu link de referidos"
              data-testid="referidos-link"
              className="h-12 flex-1 rounded-xl border border-negro/20 bg-gris-claro px-4 font-mono text-sm"
            />
            <Button type="button" size="md" onClick={copiar} data-testid="referidos-copiar">
              {copiado ? '¡Copiado!' : 'Copiar link'}
            </Button>
            {puedeCompartir && (
              <Button type="button" variant="secondary" size="md" onClick={compartir}>
                Compartir
              </Button>
            )}
          </div>
        ) : (
          <SinDatos>No pudimos generar tu link ahora. Probá de nuevo en un momento.</SinDatos>
        )}
        {data && (
          <p className="mt-3 text-xs text-gris-texto">
            Tu código: <span className="font-mono">{data.codigo}</span>
          </p>
        )}
      </Tarjeta>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Amigos referidos">
          {!data || data.referidos.length === 0 ? (
            <SinDatos>Todavía nadie se registró con tu link.</SinDatos>
          ) : (
            <ul className="divide-y divide-negro/10" data-testid="referidos-lista">
              {data.referidos.map((r, i) => (
                <li key={`${r.nombre}-${i}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{r.nombre}</p>
                    <p className="text-gris-texto">Se registró el {formatFecha(r.createdAt)}</p>
                  </div>
                  <Pastilla tone={r.estado === 'COMPRO' ? 'ok' : 'neutral'}>
                    {r.estado === 'COMPRO' ? 'Ya compró' : 'Registrado'}
                  </Pastilla>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Tus cupones">
          {!data || data.cupones.length === 0 ? (
            <SinDatos>Cuando un referido compre, tu cupón aparece acá (también te lo mandamos por email).</SinDatos>
          ) : (
            <ul className="space-y-2" data-testid="referidos-cupones">
              {data.cupones.map((c) => {
                const agotado = c.usosMax !== null && c.usos >= c.usosMax;
                const vencido = c.vigenciaHasta ? new Date(c.vigenciaHasta).getTime() < Date.now() : false;
                return (
                  <li key={c.codigo} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gris-claro px-4 py-3 text-sm">
                    <div>
                      <p className="font-mono font-semibold">{c.codigo}</p>
                      <p className="text-gris-texto">
                        {c.tipo === 'PORCENTAJE' ? `${c.valor}% de descuento` : `${formatPrecio(c.valor)} de descuento`}
                        {c.vigenciaHasta ? ` · vence el ${formatFecha(c.vigenciaHasta)}` : ''}
                      </p>
                    </div>
                    <Pastilla tone={agotado ? 'neutral' : vencido ? 'danger' : 'ok'}>
                      {agotado ? 'Usado' : vencido ? 'Vencido' : 'Disponible'}
                    </Pastilla>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
