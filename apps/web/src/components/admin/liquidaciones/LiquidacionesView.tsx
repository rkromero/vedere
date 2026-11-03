'use client';
// Liquidación mensual de ópticas: resumen general por óptica y detalle de los pedidos entregados.
import Link from 'next/link';
import { formatFecha, formatPrecio } from '@/lib/format';
import { formatMes } from '@/lib/pedidos';
import type { Liquidacion, LiquidacionGeneral } from '@/lib/pedidos';
import { Badge, Card, EmptyState, Input, PageHeader } from '@/components/admin/ui';
import { Table, Td, Th, Toolbar, Tr, useQueryParams } from '@/components/admin/table';

export function MesSelector({ mes }: { mes: string }) {
  const { set } = useQueryParams();
  return (
    <label className="flex items-center gap-2 text-sm text-gris-medio">
      Mes
      <Input type="month" value={mes} onChange={(e) => e.target.value && set({ mes: e.target.value })} className="h-10 w-44" aria-label="Mes" />
    </label>
  );
}

export function LiquidacionDetalleTable({ liq }: { liq: Liquidacion }) {
  if (liq.pedidos.length === 0) {
    return <p className="text-sm text-gris-medio">Sin pedidos entregados en {formatMes(liq.mes)}.</p>;
  }
  return (
    <Table className="border-0">
      <thead>
        <tr>
          <Th>Pedido</Th>
          <Th>Entregado</Th>
          <Th>Cliente</Th>
          <Th align="right">Ítems</Th>
          <Th align="right">Monto</Th>
          <Th align="right">Comisión</Th>
        </tr>
      </thead>
      <tbody>
        {liq.pedidos.map((p) => (
          <Tr key={p.id}>
            <Td className="font-mono text-xs">{p.numero}</Td>
            <Td>{formatFecha(p.entregadoEn)}</Td>
            <Td>{p.cliente}</Td>
            <Td align="right" className="tabular-nums">{p.items}</Td>
            <Td align="right" className="tabular-nums">{formatPrecio(p.total)}</Td>
            <Td align="right" className="tabular-nums">
              {formatPrecio(p.comision)} <span className="text-xs text-gris-medio">({p.comisionPct}%)</span>
            </Td>
          </Tr>
        ))}
        <tr className="font-semibold">
          <Td>Total</Td>
          <Td />
          <Td />
          <Td align="right" className="tabular-nums">{liq.cantidad} pedidos</Td>
          <Td align="right" className="tabular-nums">{formatPrecio(liq.monto)}</Td>
          <Td align="right" className="tabular-nums">{formatPrecio(liq.comision)}</Td>
        </tr>
      </tbody>
    </Table>
  );
}

export function LiquidacionesView({ mes, general, detalle }: { mes: string; general: LiquidacionGeneral; detalle: Liquidacion | null }) {
  const { set } = useQueryParams();
  return (
    <>
      <PageHeader
        title="Liquidaciones"
        description="Pedidos entregados por cada óptica en el mes, monto vendido y comisión a liquidar."
      />
      <Toolbar>
        <MesSelector mes={mes} />
        {detalle && (
          <button type="button" onClick={() => set({ opticaId: undefined })} className="text-sm underline underline-offset-2">
            Ver todas las ópticas
          </button>
        )}
      </Toolbar>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-negro/10 bg-blanco p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gris-medio">Entregados en {formatMes(mes)}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{general.totales.cantidad}</p>
        </div>
        <div className="rounded-xl border border-negro/10 bg-blanco p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gris-medio">Monto vendido</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatPrecio(general.totales.monto)}</p>
        </div>
        <div className="rounded-xl border border-negro/10 bg-blanco p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gris-medio">Comisiones</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatPrecio(general.totales.comision)}</p>
        </div>
      </div>

      {detalle ? (
        <Card title={`${detalle.optica?.nombre ?? 'Óptica'} · ${formatMes(detalle.mes)}`}>
          <LiquidacionDetalleTable liq={detalle} />
        </Card>
      ) : general.items.length === 0 ? (
        <EmptyState title="No hay ópticas cargadas" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Óptica</Th>
              <Th align="right">Comisión %</Th>
              <Th align="right">Entregados</Th>
              <Th align="right">Monto</Th>
              <Th align="right">Comisión</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {general.items.map((i) => (
              <Tr key={i.optica.id}>
                <Td>
                  <span className="font-medium">{i.optica.nombre}</span>
                  {!i.optica.activa && <Badge tone="neutral" className="ml-2">Pausada</Badge>}
                </Td>
                <Td align="right" className="tabular-nums">{i.optica.comisionPct}%</Td>
                <Td align="right" className="tabular-nums">{i.cantidad}</Td>
                <Td align="right" className="tabular-nums">{formatPrecio(i.monto)}</Td>
                <Td align="right" className="tabular-nums font-medium">{formatPrecio(i.comision)}</Td>
                <Td align="right">
                  <Link href={`/admin/liquidaciones?mes=${mes}&opticaId=${i.optica.id}`} className="text-xs underline underline-offset-2">
                    Detalle
                  </Link>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
