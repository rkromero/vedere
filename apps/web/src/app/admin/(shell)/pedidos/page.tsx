import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Pedidos' };

export default function PedidosPage() {
  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Pedidos de la tienda y asignación a ópticas socias."
      />
      <EmptyState
        title="Todavía no hay pedidos"
        description="El checkout y la gestión de pedidos llegan en la próxima etapa. Acá vas a ver cada pedido, su óptica asignada y su estado."
      />
    </>
  );
}
