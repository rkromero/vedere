import type { Metadata } from 'next';
import { LiquidacionesView } from '@/components/admin/liquidaciones/LiquidacionesView';
import { qs, serverApi } from '@/lib/api-server';
import { mesActual } from '@/lib/pedidos';
import type { Liquidacion, LiquidacionGeneral } from '@/lib/pedidos';

export const metadata: Metadata = { title: 'Liquidaciones' };
export const dynamic = 'force-dynamic';

export default async function LiquidacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const mes = typeof sp.mes === 'string' && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesActual();
  const opticaId = typeof sp.opticaId === 'string' ? sp.opticaId : '';
  const [general, detalle] = await Promise.all([
    serverApi<LiquidacionGeneral>(`/admin/liquidaciones${qs({ mes })}`),
    opticaId ? serverApi<Liquidacion>(`/admin/liquidaciones${qs({ mes, opticaId })}`) : Promise.resolve(null),
  ]);
  return <LiquidacionesView mes={mes} general={general} detalle={detalle} />;
}
