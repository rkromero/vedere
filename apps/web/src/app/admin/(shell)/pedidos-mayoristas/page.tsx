import type { Metadata } from 'next';
import { PedidosMayoristasTable } from '@/components/admin/mayorista/PedidosMayoristas';
import type { Paged } from '@/components/admin/table';
import { qs, serverApi } from '@/lib/api-server';
import type { PedidoMayorista } from '@/lib/mayorista';

export const metadata: Metadata = { title: 'Pedidos mayoristas' };
export const dynamic = 'force-dynamic';

const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

export default async function PedidosMayoristasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const [data, opticas] = await Promise.all([
    serverApi<Paged<PedidoMayorista> & { resumen: Partial<Record<string, number>> }>(
      `/admin/mayorista/pedidos${qs({
        q: str(sp.q),
        estado: str(sp.estado),
        opticaId: str(sp.opticaId),
        entrega: str(sp.entrega),
        desde: str(sp.desde),
        hasta: str(sp.hasta),
        page: str(sp.page),
        pageSize: '25',
      })}`,
    ),
    serverApi<Paged<{ id: string; nombre: string }>>('/admin/opticas?pageSize=100'),
  ]);
  return <PedidosMayoristasTable data={data} opticas={opticas.items.map((o) => ({ id: o.id, nombre: o.nombre }))} />;
}
