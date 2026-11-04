import { redirect } from 'next/navigation';

export default async function MayoristaPedidoRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/pedidos-mayoristas/${encodeURIComponent(id)}`);
}
