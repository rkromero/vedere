import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverApi, ServerApiError } from '@/lib/api-server';
import type { PedidoCuenta } from '@/lib/tienda/cuenta';
import { PedidoDetalleCliente } from '@/components/tienda/cuenta/PedidoDetalleCliente';

export const metadata: Metadata = { title: 'Pedido' };
export const dynamic = 'force-dynamic';

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let pedido: PedidoCuenta;
  try {
    pedido = await serverApi<PedidoCuenta>(`/cuenta/pedidos/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ServerApiError && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  }
  return <PedidoDetalleCliente pedido={pedido} />;
}
