// Detalle de un pedido en Mi cuenta: seguimiento por pasos, óptica/envío, productos, pago, receta.
import Image from 'next/image';
import Link from 'next/link';
import { buttonClasses, cn } from '@vedere/ui';
import { formatFecha, formatPrecio } from '@/lib/format';
import { ESTADO_PAGO_LABEL, METODO_PAGO_LABEL, MODALIDAD_LABEL } from '@/lib/tienda/checkout';
import type { EstadoPedido } from '@/lib/tienda/checkout';
import { esTerminal, indicePaso, labelEstadoCliente, pasosPedido } from '@/lib/tienda/cuenta';
import type { PedidoCuenta } from '@/lib/tienda/cuenta';
import { Pastilla, Tarjeta } from './Tarjeta';
import { RecetaResumen } from './RecetaResumen';

const PUEDE_SOLICITAR: EstadoPedido[] = ['LISTO', 'ENVIADO', 'ENTREGADO'];

function fechaDePaso(p: PedidoCuenta, paso: EstadoPedido): string | null | undefined {
  switch (paso) {
    case 'PENDIENTE_PAGO':
      return p.createdAt;
    case 'PAGADO':
      return p.pagadoEn;
    case 'ASIGNADO':
      return p.aceptadoEn ?? p.asignadoEn;
    case 'ENVIADO':
      return p.enviadoEn;
    case 'ENTREGADO':
      return p.entregadoEn;
    default:
      return null;
  }
}

function tonoEstado(estado: EstadoPedido): 'neutral' | 'ok' | 'warn' | 'danger' | 'info' {
  if (estado === 'ENTREGADO') return 'ok';
  if (estado === 'CANCELADO' || estado === 'DEVUELTO') return 'danger';
  if (estado === 'PENDIENTE_PAGO') return 'warn';
  return 'info';
}

export function PedidoDetalleCliente({ pedido: p }: { pedido: PedidoCuenta }) {
  const pasos = pasosPedido(p.entrega.modalidad);
  const actual = indicePaso(p.estado, pasos);
  const terminal = esTerminal(p.estado);
  const retiro = p.entrega.modalidad === 'RETIRO_OPTICA';
  const o = p.entrega.optica;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gris-texto">
            <Link href="/mi-cuenta/pedidos" className="underline underline-offset-4">
              Mis pedidos
            </Link>{' '}
            / {formatFecha(p.createdAt, true)}
          </p>
          <h2 className="font-campaign mt-1 text-4xl" data-testid="pedido-numero">
            Pedido {p.numero}
          </h2>
        </div>
        <Pastilla tone={tonoEstado(p.estado)} data-testid="pedido-estado">
          {labelEstadoCliente(p.estado, p.entrega.modalidad)}
        </Pastilla>
      </header>

      {p.estado === 'PENDIENTE_PAGO' && (
        <div className="rounded-2xl bg-sol/30 px-4 py-3 text-sm">
          Este pedido está esperando el pago.{' '}
          <Link href={`/gracias/${p.id}`} className="font-medium underline underline-offset-4">
            Ver instrucciones de pago
          </Link>
          {p.reservaExpiraEn ? ` · el stock queda reservado hasta ${formatFecha(p.reservaExpiraEn, true)}.` : '.'}
        </div>
      )}

      <Tarjeta titulo="Seguimiento">
        {terminal ? (
          <p className="text-sm">
            {p.estado === 'CANCELADO'
              ? 'Este pedido fue cancelado. Si habías pagado, el reintegro se procesa por el mismo medio de pago.'
              : 'Registramos la devolución de este pedido. El reintegro se procesa por el mismo medio de pago.'}
          </p>
        ) : (
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="pedido-timeline">
            {pasos.map((paso, i) => {
              const hecho = i < actual || (i === actual && paso === 'ENTREGADO');
              const activo = i === actual && paso !== 'ENTREGADO';
              const fecha = fechaDePaso(p, paso);
              return (
                <li
                  key={paso}
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border p-3',
                    hecho && 'border-negro bg-negro text-blanco',
                    activo && 'border-noche bg-noche/5',
                    !hecho && !activo && 'border-negro/10 text-gris-texto',
                  )}
                  aria-current={activo ? 'step' : undefined}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      hecho ? 'bg-blanco text-negro' : activo ? 'bg-noche text-blanco' : 'bg-gris-claro',
                    )}
                    aria-hidden="true"
                  >
                    {hecho ? '✓' : i + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{labelEstadoCliente(paso, p.entrega.modalidad)}</span>
                    {(hecho || activo) && fecha && (
                      <span className={cn('block text-xs', hecho ? 'text-blanco/70' : 'text-gris-texto')}>
                        {formatFecha(fecha, true)}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {p.numeroSeguimiento && (
          <p className="mt-4 rounded-2xl bg-gris-claro px-4 py-3 text-sm" data-testid="pedido-seguimiento">
            Número de seguimiento: <strong className="font-mono">{p.numeroSeguimiento}</strong>
          </p>
        )}
      </Tarjeta>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo={retiro ? 'Retiro en la óptica' : 'Envío a domicilio'}>
          {o ? (
            <div className="text-sm">
              <p className="font-semibold">{o.nombre}</p>
              <p>
                {o.direccion}, {o.localidad}
              </p>
              {o.horarios && <p className="text-gris-texto">{o.horarios}</p>}
              {o.whatsapp && (
                <a
                  href={`https://wa.me/${o.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block underline underline-offset-4"
                >
                  Escribir a la óptica por WhatsApp
                </a>
              )}
              {!retiro && (
                <p className="mt-3 border-t border-negro/10 pt-3">
                  Enviamos a: {p.entrega.direccion}
                  {p.entrega.piso ? `, ${p.entrega.piso}` : ''}, {p.entrega.localidad}, {p.entrega.provincia} (
                  {p.entrega.codigoPostal})
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gris-texto">
              {MODALIDAD_LABEL[p.entrega.modalidad]} · te confirmamos la óptica socia por email apenas esté asignada.
            </p>
          )}
        </Tarjeta>

        <Tarjeta titulo="Pago">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gris-texto">Medio</dt>
              <dd>{METODO_PAGO_LABEL[p.metodoPago]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gris-texto">Estado</dt>
              <dd>{ESTADO_PAGO_LABEL[p.estadoPago]}</dd>
            </div>
            {p.cuotas > 1 && (
              <div className="flex justify-between gap-4">
                <dt className="text-gris-texto">Cuotas</dt>
                <dd>{p.cuotas} sin interés</dd>
              </div>
            )}
            {p.pagadoEn && (
              <div className="flex justify-between gap-4">
                <dt className="text-gris-texto">Acreditado</dt>
                <dd>{formatFecha(p.pagadoEn, true)}</dd>
              </div>
            )}
            {p.pago?.comprobanteUrl && (
              <div className="flex justify-between gap-4">
                <dt className="text-gris-texto">Comprobante</dt>
                <dd>
                  <a href={p.pago.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    Ver
                  </a>
                </dd>
              </div>
            )}
            {p.numeroFactura && (
              <div className="flex justify-between gap-4">
                <dt className="text-gris-texto">Factura</dt>
                <dd>{p.numeroFactura}</dd>
              </div>
            )}
          </dl>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Productos">
        <ul className="divide-y divide-negro/10">
          {p.items.map((i) => (
            <li key={i.id} className="flex items-center gap-4 py-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gris-claro">
                {i.imagen && <Image src={i.imagen} alt="" fill sizes="64px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{i.nombre}</p>
                <p className="text-gris-texto">
                  {i.color} · {i.cantidad} u.
                  {i.conReceta ? ' · con receta' : ''}
                </p>
              </div>
              <p className="text-sm font-medium tabular-nums">{formatPrecio(i.total)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-negro/10 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-gris-texto">Subtotal</dt>
            <dd className="tabular-nums">{formatPrecio(p.totales.subtotal)}</dd>
          </div>
          {p.totales.descuentos > 0 && (
            <div className="flex justify-between">
              <dt className="text-gris-texto">Descuentos{p.cuponCodigo ? ` (${p.cuponCodigo})` : ''}</dt>
              <dd className="tabular-nums">− {formatPrecio(p.totales.descuentos)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gris-texto">Envío</dt>
            <dd className="tabular-nums">{p.totales.envio > 0 ? formatPrecio(p.totales.envio) : 'Gratis'}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPrecio(p.totales.total)}</dd>
          </div>
        </dl>
      </Tarjeta>

      {p.receta && (
        <Tarjeta titulo="Receta usada">
          <div data-testid="receta-item">
            <RecetaResumen receta={p.receta} />
          </div>
        </Tarjeta>
      )}

      <div className="flex flex-wrap gap-3">
        {PUEDE_SOLICITAR.includes(p.estado) && (
          <Link href={`/cambios-y-devoluciones?pedido=${encodeURIComponent(p.numero)}#solicitud`} className={buttonClasses('secondary', 'sm')}>
            Solicitar cambio o devolución
          </Link>
        )}
        <Link href={`/contacto?motivo=pedido&pedido=${encodeURIComponent(p.numero)}`} className={buttonClasses('ghost', 'sm')}>
          Tengo una consulta sobre este pedido
        </Link>
      </div>
    </div>
  );
}
