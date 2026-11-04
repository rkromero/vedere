import type { Metadata } from 'next';
import { PedidosMayoristasTable } from '@/components/admin/mayorista/PedidosMayoristas';
import type { Paged } from '@/components/admin/table';
import { qs, serverApi } from '@/lib/api-server';
import type { PedidoMayorista } from '@/lib/mayorista';

export const metadata: Metadata = { title: 'Pedidos mayoristas' };
export const dynamic = 'force-dynamic';

export default async function PedidosMayoristasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = await serverApi<Paged<PedidoMayorista> & { resumen: Partial<Record<string, number>> }>(
    `/admin/mayorista/pedidos${qs({ q: sp.q, estado: sp.estado, page: sp.page, pageSize: '25' })}`,
  );
  return <PedidosMayoristasTable data={data} />;
}
