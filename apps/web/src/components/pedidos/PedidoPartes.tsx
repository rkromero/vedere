'use client';
// Bloques compartidos del detalle de un pedido (backoffice y panel de la óptica): ítems, cliente y
// entrega, receta y línea de tiempo.
import { Badge, Card } from '@/components/admin/ui';
import { Table, Td, Th, Tr } from '@/components/admin/table';
import { LABELS, formatFecha, formatPrecio } from '@/lib/format';
import {
  labelEstadoPedido,
  TIPO_EVENTO_LABEL,
  estadoPedidoTone,
} from '@/lib/pedidos';
import type { Pedido, PedidoEvento, Receta } from '@/lib/pedidos';
import type { Modalidad } from '@/lib/tienda/checkout';
import { MODALIDAD_LABEL } from '@/lib/tienda/checkout';

export function ItemsCard({ pedido }: { pedido: Pedido }) {
  return (
    <Card title={`Ítems (${pedido.items.length})`}>
      <Table className="border-0">
        <thead>
          <tr>
            <Th>Producto</Th>
            <Th>Línea</Th>
            <Th align="right">Cant.</Th>
            <Th align="right">Precio</Th>
            <Th align="right">Total</Th>
          </tr>
        </thead>
        <tbody>
          {pedido.items.map((i) => (
            <Tr key={i.id}>
              <Td>
                <div className="flex items-center gap-3">
                  {i.imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.imagen} alt="" className="h-12 w-12 rounded-md object-cover" />
                  ) : (
                    <span className="h-12 w-12 rounded-md bg-gris-claro" />
                  )}
                  <div>
                    <p className="font-medium">{i.nombre}</p>
                    <p className="text-xs text-gris-medio">
                      {i.color ?? ''} · <span className="font-mono">{i.sku}</span>
                      {i.conReceta && <Badge tone="info" className="ml-2">Con receta</Badge>}
                    </p>
                  </div>
                </div>
              </Td>
              <Td>{LABELS.linea[i.linea]}</Td>
              <Td align="right" className="tabular-nums">{i.cantidad}</Td>
              <Td align="right" className="tabular-nums">
                {formatPrecio(i.precioUnitario)}
                {i.descuento > 0 && <span className="block text-xs text-gris-medio">-{formatPrecio(i.descuento)}</span>}
              </Td>
              <Td align="right" className="tabular-nums font-medium">{formatPrecio(i.total)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <dl className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-gris-medio">Subtotal</dt><dd className="tabular-nums">{formatPrecio(pedido.totales.subtotal)}</dd></div>
        {pedido.totales.detalle.map((d, idx) => (
          <div key={idx} className="flex justify-between text-gris-medio">
            <dt>{d.descripcion}{d.codigo ? ` (${d.codigo})` : ''}</dt>
            <dd className="tabular-nums">-{formatPrecio(d.monto)}</dd>
          </div>
        ))}
        <div className="flex justify-between"><dt className="text-gris-medio">Envío</dt><dd className="tabular-nums">{pedido.totales.envio === 0 ? 'Gratis' : formatPrecio(pedido.totales.envio)}</dd></div>
        <div className="flex justify-between border-t border-negro/10 pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatPrecio(pedido.totales.total)}</dd></div>
        {(pedido.reembolsado ?? 0) > 0 && (
          <div className="flex justify-between text-carey"><dt>Reembolsado</dt><dd className="tabular-nums">-{formatPrecio(pedido.reembolsado)}</dd></div>
        )}
      </dl>
    </Card>
  );
}

export function ClienteEntregaCard({ pedido }: { pedido: Pedido }) {
  const e = pedido.entrega;
  return (
    <Card title="Cliente y entrega">
      <div className="grid gap-5 sm:grid-cols-2">
        <dl className="space-y-1 text-sm">
          <dt className="text-xs font-medium uppercase tracking-wide text-gris-medio">Cliente</dt>
          <dd className="font-medium">{pedido.cliente.nombre}</dd>
          <dd><a href={`mailto:${pedido.cliente.email}`} className="underline-offset-2 hover:underline">{pedido.cliente.email}</a></dd>
          {pedido.cliente.telefono && (
            <dd>
              <a href={`https://wa.me/${pedido.cliente.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                {pedido.cliente.telefono}
              </a>
            </dd>
          )}
          {pedido.cliente.dni && <dd className="text-gris-medio">DNI {pedido.cliente.dni}</dd>}
          {pedido.notas && <dd className="mt-2 rounded-lg bg-gris-claro px-3 py-2 text-xs">Nota del cliente: {pedido.notas}</dd>}
        </dl>
        <dl className="space-y-1 text-sm">
          <dt className="text-xs font-medium uppercase tracking-wide text-gris-medio">{MODALIDAD_LABEL[e.modalidad]}</dt>
          {e.modalidad === 'ENVIO_DOMICILIO' ? (
            <>
              <dd className="font-medium">{e.direccionCompleta ?? [e.direccion, e.piso].filter(Boolean).join(', ')}</dd>
              <dd className="text-gris-medio">{[e.localidad, e.provincia, e.codigoPostal].filter(Boolean).join(' · ')}</dd>
              {pedido.numeroSeguimiento && <dd>Seguimiento: <span className="font-mono">{pedido.numeroSeguimiento}</span></dd>}
            </>
          ) : e.optica ? (
            <>
              <dd className="font-medium">{e.optica.nombre}</dd>
              <dd className="text-gris-medio">{e.optica.direccion}, {e.optica.localidad}</dd>
              {e.optica.horarios && <dd className="text-xs text-gris-medio">{e.optica.horarios}</dd>}
            </>
          ) : (
            <dd className="text-gris-medio">Óptica a definir</dd>
          )}
          {e.lat !== null && e.lng !== null && (
            <dd className="text-xs text-gris-medio">
              Cliente geolocalizado:{' '}
              <a href={`https://www.openstreetmap.org/?mlat=${e.lat}&mlon=${e.lng}#map=15/${e.lat}/${e.lng}`} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                ver en el mapa
              </a>
            </dd>
          )}
        </dl>
      </div>
    </Card>
  );
}

const fmtDiop = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`);

export function RecetaCard({ receta }: { receta: Receta | null }) {
  if (!receta) return null;
  return (
    <Card title="Receta">
      {receta.modo === 'OPTICA' && (
        <p className="text-sm">El cliente la lleva a la óptica: hay que medir en el local (agendá un turno de medición).</p>
      )}
      {receta.modo === 'ARCHIVO' && (
        <p className="text-sm">
          Receta adjunta:{' '}
          {receta.archivoUrl ? (
            <a href={receta.archivoUrl} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
              {receta.archivoNombre ?? 'descargar archivo'}
            </a>
          ) : (
            <span className="text-gris-medio">archivo no disponible</span>
          )}
        </p>
      )}
      {receta.modo === 'VALORES' && (
        <table className="w-full max-w-md text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gris-medio">
              <th className="py-1 text-left font-medium">Ojo</th>
              <th className="py-1 text-right font-medium">Esfera</th>
              <th className="py-1 text-right font-medium">Cilindro</th>
              <th className="py-1 text-right font-medium">Eje</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr><td className="py-1">OD</td><td className="py-1 text-right">{fmtDiop(receta.odEsfera)}</td><td className="py-1 text-right">{fmtDiop(receta.odCilindro)}</td><td className="py-1 text-right">{receta.odEje ?? '—'}°</td></tr>
            <tr><td className="py-1">OI</td><td className="py-1 text-right">{fmtDiop(receta.oiEsfera)}</td><td className="py-1 text-right">{fmtDiop(receta.oiCilindro)}</td><td className="py-1 text-right">{receta.oiEje ?? '—'}°</td></tr>
          </tbody>
        </table>
      )}
      {(receta.adicion !== null || receta.dp !== null) && (
        <p className="mt-2 text-sm text-gris-medio">
          {receta.adicion !== null && <>Adición {fmtDiop(receta.adicion)} · </>}
          {receta.dp !== null && <>DP {receta.dp} mm</>}
        </p>
      )}
      {receta.notas && <p className="mt-2 text-sm">Notas: {receta.notas}</p>}
    </Card>
  );
}

const TONO_EVENTO: Record<PedidoEvento['tipo'], 'neutral' | 'ok' | 'warn' | 'danger' | 'info'> = {
  ESTADO: 'info',
  ASIGNACION: 'ok',
  RECHAZO: 'danger',
  NOTA: 'neutral',
  EMAIL: 'neutral',
  PAGO: 'ok',
  REEMBOLSO: 'warn',
  SOLICITUD: 'warn',
};

export function Timeline({ eventos, ocultarNotas, modalidad }: { eventos: PedidoEvento[]; ocultarNotas?: boolean; modalidad?: Modalidad | null }) {
  const lista = (ocultarNotas ? eventos.filter((e) => e.tipo !== 'NOTA' && e.tipo !== 'EMAIL') : eventos).slice().reverse();
  if (lista.length === 0) return <p className="text-sm text-gris-medio">Sin movimientos todavía.</p>;
  return (
    <ol className="relative space-y-4 border-l border-negro/10 pl-5">
      {lista.map((e) => (
        <li key={e.id} className="relative text-sm">
          <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-blanco bg-negro" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TONO_EVENTO[e.tipo] ?? 'neutral'}>{TIPO_EVENTO_LABEL[e.tipo] ?? e.tipo}</Badge>
            {e.tipo === 'ESTADO' && e.estadoNuevo && (
              <Badge tone={estadoPedidoTone(e.estadoNuevo)}>{labelEstadoPedido(e.estadoNuevo, modalidad)}</Badge>
            )}
            <span className="text-xs text-gris-medio">{formatFecha(e.createdAt, true)}</span>
          </div>
          {e.nota && <p className="mt-1 whitespace-pre-line">{e.nota}</p>}
          <p className="mt-0.5 text-xs text-gris-medio">
            {e.actor.nombre ?? 'Sistema'}
            {e.actor.rol && ` · ${LABELS.rol[e.actor.rol]}`}
            {e.optica && ` · ${e.optica.nombre}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
