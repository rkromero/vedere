import type { Metadata } from 'next';
import { LiquidacionDetalleTable, MesSelector } from '@/components/admin/liquidaciones/LiquidacionesView';
import { Card, PageHeader } from '@/components/admin/ui';
import { qs, serverApi } from '@/lib/api-server';
import { formatPrecio } from '@/lib/format';
import { formatMes, mesActual } from '@/lib/pedidos';
import type { Liquidacion } from '@/lib/pedidos';

export const metadata: Metadata = { title: 'Liquidación' };
export const dynamic = 'force-dynamic';

export default async function OpticaLiquidacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const mes = typeof sp.mes === 'string' && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesActual();
  const liq = await serverApi<Liquidacion>(`/optica/liquidacion${qs({ mes })}`);
  return (
    <>
      <PageHeader
        title="Liquidación mensual"
        description="Pedidos entregados en el mes, monto vendido y comisión que Vedere te liquida."
      />
      <div className="mb-4">
        <MesSelector mes={mes} />
      </div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-negro/10 bg-blanco p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gris-medio">Entregados en {formatMes(liq.mes)}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{liq.cantidad}</p>
        </div>
        <div className="rounded-xl border border-negro/10 bg-blanco p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gris-medio">Monto vendido</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatPrecio(liq.monto)}</p>
        </div>
        <div className="rounded-xl border border-negro/10 bg-blanco p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gris-medio">Comisión ({liq.optica?.comisionPct ?? 0}%)</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatPrecio(liq.comision)}</p>
        </div>
      </div>
      <Card title={`Detalle · ${formatMes(liq.mes)}`}>
        <LiquidacionDetalleTable liq={liq} />
      </Card>
    </>
  );
}
