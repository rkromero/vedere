import type { Metadata } from 'next';
import { ComprasTable } from '@/components/optica/mayorista/Compras';
import type { Paged } from '@/components/admin/table';
import { qs, serverApi } from '@/lib/api-server';
import type { PedidoMayorista } from '@/lib/mayorista';

export const metadata: Metadata = { title: 'Mis compras' };
export const dynamic = 'force-dynamic';

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = await serverApi<Paged<PedidoMayorista>>(
    `/optica/mayorista/pedidos${qs({ q: sp.q, estado: sp.estado, page: sp.page, pageSize: '25' })}`,
  );
  return <ComprasTable data={data} />;
}
