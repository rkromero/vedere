import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CuentaOpticaAdmin } from '@/components/admin/cuentas/Cuentas';
import { ServerApiError, qs, serverApi } from '@/lib/api-server';
import type { MovimientosPaginados, PedidoConDeuda, ResumenCuenta } from '@/lib/mayorista';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Cuenta corriente' };
export const dynamic = 'force-dynamic';

export default async function CuentaOpticaPage({
  params,
  searchParams,
}: {
  params: Promise<{ opticaId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { opticaId } = await params;
  const sp = await searchParams;
  const id = encodeURIComponent(opticaId);
  try {
    const [cuenta, movimientos, user] = await Promise.all([
      serverApi<{ optica: { id: string; nombre: string; cuit: string | null; email: string | null }; resumen: ResumenCuenta; pedidosPendientes: PedidoConDeuda[] }>(
        `/admin/cuentas/${id}`,
      ),
      serverApi<MovimientosPaginados>(`/admin/cuentas/${id}/movimientos${qs({ page: typeof sp.page === 'string' ? sp.page : undefined, pageSize: '30' })}`),
      getSession(),
    ]);
    return <CuentaOpticaAdmin {...cuenta} movimientos={movimientos} esAdmin={user?.rol === 'ADMIN'} />;
  } catch (err) {
    if (err instanceof ServerApiError && err.status === 404) notFound();
    throw err;
  }
}
