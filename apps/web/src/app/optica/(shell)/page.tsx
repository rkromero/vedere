import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, LinkBtn, PageHeader } from '@/components/admin/ui';
import { Table, Td, Th, Tr } from '@/components/admin/table';
import { serverApiOrNull } from '@/lib/api-server';
import { LABELS, formatFecha, formatPrecio } from '@/lib/format';
import { ESTADO_PEDIDO_LABEL, estadoPedidoTone } from '@/lib/pedidos';
import type { OpticaMe, PedidoOpticaFila } from '@/lib/pedidos';
import { MODALIDAD_LABEL } from '@/lib/tienda/checkout';
import type { Paged } from '@/lib/types';

export const metadata: Metadata = { title: 'Resumen' };
export const dynamic = 'force-dynamic';

function Stat({ label, value, href, hint, tone }: { label: string; value: number; href: string; hint?: string; tone?: 'warn' }) {
  return (
    <Link href={href} className={`rounded-xl border bg-blanco p-5 transition-colors hover:border-negro/40 ${tone === 'warn' && value > 0 ? 'border-sol' : 'border-negro/10'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gris-medio">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-gris-medio">{hint}</p>}
    </Link>
  );
}

export default async function OpticaHomePage() {
  const [me, pendientes] = await Promise.all([
    serverApiOrNull<OpticaMe>('/optica/me'),
    serverApiOrNull<Paged<PedidoOpticaFila>>('/optica/pedidos?estado=ASIGNADO&pageSize=10'),
  ]);
  if (!me) {
    return <EmptyState title="No se pudo cargar tu óptica" description="La API no respondió. Probá de nuevo en unos minutos." />;
  }
  const ahora = Date.now();
  return (
    <>
      <PageHeader
        title={me.optica.nombre}
        description={`${me.optica.direccion}, ${me.optica.localidad} · radio de cobertura ${me.optica.radioKm} km · hasta ${me.optica.capacidadDiaria} pedidos por día · comisión ${me.optica.comisionPct}%`}
        actions={
          <>
            <LinkBtn href="/optica/pedidos">Ver pedidos</LinkBtn>
            <LinkBtn href="/optica/turnos" variant="secondary">
              Agenda
            </LinkBtn>
          </>
        }
      />
      {!me.optica.activa && (
        <p className="mb-5 rounded-lg bg-sol/20 px-4 py-3 text-sm">
          Tu óptica está <strong>pausada</strong>: no recibe pedidos nuevos hasta que Vedere la reactive.
        </p>
      )}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Para aceptar" value={me.resumen.pendientes} href="/optica/pedidos?estado=ASIGNADO" hint="Respondé dentro del plazo" tone="warn" />
        <Stat label="En curso" value={me.resumen.enCurso} href="/optica/pedidos" hint="Aceptados, en armado, listos o enviados" />
        <Stat label="Turnos hoy" value={me.resumen.turnosHoy} href="/optica/turnos" />
      </div>

      <Card title="Pedidos pendientes de aceptación">
        {!pendientes || pendientes.items.length === 0 ? (
          <p className="text-sm text-gris-medio">No tenés pedidos esperando respuesta.</p>
        ) : (
          <Table className="border-0">
            <thead>
              <tr>
                <Th>Pedido</Th>
                <Th>Cliente</Th>
                <Th>Entrega</Th>
                <Th>Aceptar antes de</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {pendientes.items.map((p) => {
                const vencido = p.aceptarAntesDe && new Date(p.aceptarAntesDe).getTime() < ahora;
                return (
                  <Tr key={p.id}>
                    <Td>
                      <Link href={`/optica/pedidos/${p.id}`} className="font-mono font-medium underline-offset-2 hover:underline">
                        {p.numero}
                      </Link>
                      <span className="block text-xs text-gris-medio">
                        {p.lineas.map((l) => LABELS.linea[l]).join(', ')}
                        {p.conReceta && <Badge tone="info" className="ml-2">Con receta</Badge>}
                      </span>
                    </Td>
                    <Td>{p.cliente.nombre}</Td>
                    <Td className="text-xs">{MODALIDAD_LABEL[p.modalidad]}{p.localidad && <span className="block text-gris-medio">{p.localidad}</span>}</Td>
                    <Td>
                      {p.aceptarAntesDe ? formatFecha(p.aceptarAntesDe, true) : '—'}
                      {vencido && <Badge tone="danger" className="ml-2">Vencido</Badge>}
                      <Badge tone={estadoPedidoTone(p.estado)} className="ml-2">{ESTADO_PEDIDO_LABEL[p.estado]}</Badge>
                    </Td>
                    <Td align="right" className="tabular-nums">{formatPrecio(p.total)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
