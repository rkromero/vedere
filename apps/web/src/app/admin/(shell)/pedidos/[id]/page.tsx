import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PedidoDetalle } from '@/components/admin/pedidos/PedidoDetalle';
import { ServerApiError, serverApi } from '@/lib/api-server';
import type { PedidoAdmin } from '@/lib/pedidos';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const p = await serverApi<PedidoAdmin>(`/admin/pedidos/${id}`);
    return { title: `Pedido ${p.numero}` };
  } catch {
    return { title: 'Pedido' };
  }
}

export default async function PedidoAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let pedido: PedidoAdmin;
  try {
    pedido = await serverApi<PedidoAdmin>(`/admin/pedidos/${id}`);
  } catch (err) {
    if (err instanceof ServerApiError && err.status === 404) notFound();
    throw err;
  }
  const user = await getSession();
  return <PedidoDetalle inicial={pedido} esAdmin={user?.rol === 'ADMIN'} />;
}
