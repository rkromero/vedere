import type { Metadata } from 'next';
import { CuentaOptica } from '@/components/optica/cuenta/CuentaOptica';
import type { Paged } from '@/components/admin/table';
import { qs, serverApi } from '@/lib/api-server';
import type { MovimientosPaginados, PagoInformado, PedidoConDeuda, ResumenCuenta } from '@/lib/mayorista';

export const metadata: Metadata = { title: 'Cuenta corriente' };
export const dynamic = 'force-dynamic';

export default async function CuentaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const [cuenta, movimientos, pagos] = await Promise.all([
    serverApi<{ resumen: ResumenCuenta; pedidosPendientes: PedidoConDeuda[] }>('/optica/cuenta'),
    serverApi<MovimientosPaginados>(`/optica/cuenta/movimientos${qs({ page: typeof sp.page === 'string' ? sp.page : undefined, pageSize: '30' })}`),
    serverApi<Paged<PagoInformado>>('/optica/cuenta/pagos-informados?pageSize=10'),
  ]);
  return <CuentaOptica resumen={cuenta.resumen} pedidosPendientes={cuenta.pedidosPendientes} movimientos={movimientos} pagos={pagos} />;
}
