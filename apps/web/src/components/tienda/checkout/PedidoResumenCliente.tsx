// Vista del pedido para el cliente (gracias, buscar pedido, Mi cuenta): estado con línea de tiempo,
// óptica socia, ítems, totales y receta. Server-safe (sin hooks).
import Image from 'next/image';
import { IconCheck, cn, formatARS } from '@vedere/ui';
import { formatFecha } from '@/lib/format';
import { ORDEN_ESTADO, formatDioptria, labelEstadoCliente, pasosPedido } from '@/lib/tienda/checkout';
import type { PedidoPublico } from '@/lib/tienda/checkout';

export function TimelinePedido({ pedido }: { pedido: PedidoPublico }) {
  const terminal = pedido.estado === 'CANCELADO' || pedido.estado === 'DEVUELTO';
  const orden = ORDEN_ESTADO[pedido.estado];
  const pasos = pasosPedido(pedido.entrega.modalidad);
  return (
    <ol className="font-text relative space-y-4" aria-label="Seguimiento del pedido">
      {pasos.map((p, idx) => {
        const o = ORDEN_ESTADO[p.estado];
        const hecho = !terminal && orden >= o;
        const actual = !terminal && (orden === o || (p.estado === 'ASIGNADO' && pedido.estado === 'ACEPTADO'));
        return (
          <li key={p.estado} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  hecho ? 'border-negro bg-negro text-blanco' : 'border-negro/20 bg-blanco text-gris-texto',
                  actual && 'ring-4 ring-vetro/50',
                )}
              >
                {hecho ? <IconCheck size={14} /> : idx + 1}
              </span>
              {idx < pasos.length - 1 && <span aria-hidden="true" className={cn('mt-1 w-px flex-1', hecho ? 'bg-negro' : 'bg-negro/15')} />}
            </div>
            <div className="pb-2">
              <p className={cn('text-sm font-medium', !hecho && 'text-gris-texto')}>
                {p.estado === 'ASIGNADO' && pedido.estado === 'ACEPTADO' ? 'Confirmado por tu óptica' : p.label}
              </p>
              <p className="text-xs text-gris-texto">{p.detalle}</p>
              {p.estado === 'ENVIADO' && pedido.numeroSeguimiento && (
                <p className="mt-1 text-xs">
                  Seguimiento: <span className="font-mono font-medium">{pedido.numeroSeguimiento}</span>
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function EstadoPedidoBadge({ pedido }: { pedido: PedidoPublico }) {
  const terminal = pedido.estado === 'CANCELADO' || pedido.estado === 'DEVUELTO';
  const pendiente = pedido.estado === 'PENDIENTE_PAGO';
  return (
    <span
      className={cn(
        'font-text inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
        terminal ? 'bg-carey/15 text-carey' : pendiente ? 'bg-sol/40' : 'bg-vetro/30',
      )}
      data-testid="gracias-estado"
    >
      {labelEstadoCliente(pedido.estado, pedido.entrega.modalidad)}
    </span>
  );
}

export function ItemsPedido({ pedido }: { pedido: PedidoPublico }) {
  const t = pedido.totales;
  return (
    <div className="font-text">
      <ul className="divide-y divide-negro/10" aria-label="Productos del pedido">
        {pedido.items.map((i) => (
          <li key={i.id} className="flex gap-3 py-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gris-claro">
              {i.imagen && <Image src={i.imagen} alt="" fill sizes="64px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{i.nombre}</p>
              <p className="text-gris-texto">
                {i.color} · {i.cantidad} {i.cantidad === 1 ? 'unidad' : 'unidades'}
                {i.conReceta && ' · con receta'}
              </p>
            </div>
            <p className="text-sm font-semibold">{formatARS(i.total)}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 border-t border-negro/10 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-gris-texto">Subtotal</dt>
          <dd>{formatARS(t.subtotal)}</dd>
        </div>
        {t.detalle.map((d, idx) => (
          <div key={`${d.tipo}-${idx}`} className="flex justify-between gap-3 text-noche">
            <dt className="truncate">{d.descripcion}</dt>
            <dd className="shrink-0">−{formatARS(d.monto)}</dd>
          </div>
        ))}
        <div className="flex justify-between">
          <dt className="text-gris-texto">{pedido.entrega.modalidad === 'RETIRO_OPTICA' ? 'Retiro en óptica' : 'Envío'}</dt>
          <dd>{t.envio === 0 ? 'Gratis' : formatARS(t.envio)}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-negro/10 pt-2 text-base">
          <dt className="font-semibold">Total</dt>
          <dd className="text-xl font-semibold">{formatARS(t.total)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function OpticaPedido({ pedido }: { pedido: PedidoPublico }) {
  const o = pedido.entrega.optica;
  const retiro = pedido.entrega.modalidad === 'RETIRO_OPTICA';
  if (!o) {
    return (
      <p className="font-text text-sm text-gris-texto">
        Te avisamos por email qué óptica socia va a {retiro ? 'entregarte' : 'enviarte'} tus anteojos.
      </p>
    );
  }
  return (
    <div className="font-text text-sm">
      <p className="text-base font-semibold">{o.nombre}</p>
      <p>
        {o.direccion}, {o.localidad}
      </p>
      {o.horarios && <p className="text-gris-texto">{o.horarios}</p>}
      {o.whatsapp && (
        <a href={`https://wa.me/${o.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block underline underline-offset-4">
          WhatsApp de la óptica
        </a>
      )}
      <p className="mt-2 text-xs text-gris-texto">
        {retiro ? 'Pasá con tu DNI cuando te avisemos que está listo. Te los ajustan en el momento.' : 'Si necesitás un ajuste cuando los recibas, acercate sin cargo.'}
      </p>
    </div>
  );
}

export function RecetaPedido({ pedido }: { pedido: PedidoPublico }) {
  const r = pedido.receta;
  if (!r) return null;
  return (
    <div className="font-text text-sm" data-testid="receta-item">
      {r.modo === 'ARCHIVO' && r.archivoUrl ? (
        <a href={r.archivoUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          {r.archivoNombre ?? 'Ver receta'}
        </a>
      ) : r.modo === 'OPTICA' ? (
        <p>Te la miden en la óptica socia.</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-gris-texto">OD</dt>
          <dd>
            Esf {formatDioptria(r.odEsfera)} · Cil {formatDioptria(r.odCilindro)} · Eje {r.odEje ?? 0}°
          </dd>
          <dt className="text-gris-texto">OI</dt>
          <dd>
            Esf {formatDioptria(r.oiEsfera)} · Cil {formatDioptria(r.oiCilindro)} · Eje {r.oiEje ?? 0}°
          </dd>
          {r.adicion != null && (
            <>
              <dt className="text-gris-texto">Adición</dt>
              <dd>{formatDioptria(r.adicion)}</dd>
            </>
          )}
          {r.dp != null && (
            <>
              <dt className="text-gris-texto">DP</dt>
              <dd>{r.dp} mm</dd>
            </>
          )}
        </dl>
      )}
      <p className="mt-1 text-xs text-gris-texto">Cargada el {formatFecha(r.createdAt)}</p>
    </div>
  );
}

export function DatosEntrega({ pedido }: { pedido: PedidoPublico }) {
  const e = pedido.entrega;
  return (
    <p className="font-text text-sm">
      {e.direccion}
      {e.piso ? `, ${e.piso}` : ''}
      <br />
      {e.localidad}, {e.provincia} ({e.codigoPostal})
    </p>
  );
}
