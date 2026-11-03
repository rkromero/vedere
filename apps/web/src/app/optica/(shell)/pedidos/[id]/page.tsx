import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OpticaPedidoDetalle } from '@/components/optica/OpticaPedidoDetalle';
import { ServerApiError, serverApi } from '@/lib/api-server';
import type { Pedido } from '@/lib/pedidos';
import { EmptyState, LinkBtn } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const p = await serverApi<Pedido>(`/optica/pedidos/${id}`);
    return { title: `Pedido ${p.numero}` };
  } catch {
    return { title: 'Pedido' };
  }
}

export default async function OpticaPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const pedido = await serverApi<Pedido>(`/optica/pedidos/${id}`);
    return <OpticaPedidoDetalle inicial={pedido} />;
  } catch (err) {
    if (err instanceof ServerApiError && err.status === 404) notFound();
    if (err instanceof ServerApiError && err.status === 403) {
      // El pedido existe pero es de otra óptica: la API devuelve 403 y acá no se muestra nada de él.
      return (
        <EmptyState
          title="Este pedido no es de tu óptica"
          description="Sólo podés ver los pedidos que Vedere asignó a tu óptica."
          action={<LinkBtn href="/optica/pedidos">Volver a mis pedidos</LinkBtn>}
        />
      );
    }
    throw err;
  }
}
