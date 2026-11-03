'use client';
// Resumen del pedido en el checkout: ítems, descuentos, envío, total y cuotas.
import Image from 'next/image';
import { formatARS } from '@vedere/ui';
import type { CartItem } from '@/lib/tienda/types';
import type { Cotizacion } from '@/lib/tienda/checkout';

export function Resumen({
  items,
  cotizacion,
  modalidad,
}: {
  items: CartItem[];
  cotizacion: Cotizacion | null;
  modalidad: 'RETIRO_OPTICA' | 'ENVIO_DOMICILIO';
}) {
  const subtotalLocal = items.reduce((a, i) => a + i.precio * i.cantidad, 0);
  const t = cotizacion?.totales ?? null;
  return (
    <div className="font-text rounded-2xl border border-negro/10 bg-blanco p-5">
      <h2 className="text-lg font-semibold">Tu pedido</h2>
      <ul className="mt-4 divide-y divide-negro/10" aria-label="Productos del pedido">
        {items.map((i) => {
          const c = cotizacion?.items.find((x) => x.varianteId === i.varianteId);
          return (
            <li key={i.varianteId} className="flex gap-3 py-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gris-claro">
                {i.imagen && <Image src={i.imagen} alt="" fill sizes="64px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">{i.nombre}</p>
                <p className="text-gris-texto">
                  {i.color} · {i.cantidad} {i.cantidad === 1 ? 'unidad' : 'unidades'}
                  {(i.conReceta || i.linea === 'RECETADO' || i.linea === 'MULTIFOCAL') && ' · con receta'}
                </p>
              </div>
              <p className="text-right text-sm">
                <span className="block font-semibold">{formatARS(c ? c.total : i.precio * i.cantidad)}</span>
                {c && c.descuento > 0 && (
                  <s className="block text-xs text-gris-texto">{formatARS(i.precio * i.cantidad)}</s>
                )}
              </p>
            </li>
          );
        })}
      </ul>
      <dl className="mt-4 space-y-1.5 border-t border-negro/10 pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-gris-texto">Subtotal</dt>
          <dd>{formatARS(t?.subtotal ?? subtotalLocal)}</dd>
        </div>
        {t?.descuentos.map((d) => (
          <div key={`${d.tipo}-${d.id ?? d.codigo ?? d.descripcion}`} className="flex justify-between gap-3 text-noche">
            <dt className="truncate">{d.descripcion}</dt>
            <dd className="shrink-0">−{formatARS(d.monto)}</dd>
          </div>
        ))}
        <div className="flex justify-between">
          <dt className="text-gris-texto">{modalidad === 'RETIRO_OPTICA' ? 'Retiro en óptica' : 'Envío'}</dt>
          <dd>
            {t ? (t.envio === 0 ? 'Gratis' : formatARS(t.envio)) : '—'}
            {t?.envioGratisPor && t.envioGratisPor !== 'retiro' && (
              <span className="block text-right text-xs text-gris-texto">{t.envioGratisPor}</span>
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-negro/10 pt-3 text-base">
          <dt className="font-semibold">Total</dt>
          <dd className="text-xl font-semibold" aria-live="polite">
            {formatARS(t?.total ?? subtotalLocal)}
          </dd>
        </div>
      </dl>
      {t && t.ahorroTotal > 0 && (
        <p className="mt-3 rounded-xl bg-sol/30 px-3 py-2 text-sm font-medium">
          Ahorrás {formatARS(t.ahorroTotal)} en esta compra
        </p>
      )}
      {cotizacion && (
        <p className="mt-3 text-sm text-gris-texto">
          {cotizacion.cuotas.cantidad} cuotas sin interés de {formatARS(cotizacion.cuotas.valorCuota)} con tarjetas
          bancarias.
        </p>
      )}
      {t && t.promosDescartadas.length > 0 && (
        <p className="mt-2 text-xs text-gris-texto">
          Las promociones no se combinan: aplicamos la de mayor descuento.
        </p>
      )}
    </div>
  );
}
