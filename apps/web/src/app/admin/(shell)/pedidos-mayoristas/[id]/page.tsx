import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PedidoMayoristaAdmin } from '@/components/admin/mayorista/PedidosMayoristas';
import { ServerApiError, serverApi } from '@/lib/api-server';
import type { PedidoMayorista } from '@/lib/mayorista';

export const metadata: Metadata = { title: 'Pedido mayorista' };
export const dynamic = 'force-dynamic';

export default async function PedidoMayoristaAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const p = await serverApi<PedidoMayorista>(`/admin/mayorista/pedidos/${encodeURIComponent(id)}`);
    return <PedidoMayoristaAdmin key={p.id} inicial={p} />;
  } catch (err) {
    if (err instanceof ServerApiError && err.status === 404) notFound();
    throw err;
  }
}
