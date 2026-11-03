import type { Metadata } from 'next';
import { PedidosTable } from '@/components/admin/pedidos/PedidosTable';
import { qs, serverApi } from '@/lib/api-server';
import type { PedidoFila, PedidosResumen } from '@/lib/pedidos';
import type { OpticaAdmin, Paged } from '@/lib/types';

export const metadata: Metadata = { title: 'Pedidos' };
export const dynamic = 'force-dynamic';

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const query = qs({
    q: sp.q,
    estado: sp.estado,
    estadoPago: sp.estadoPago,
    metodoPago: sp.metodoPago,
    opticaId: sp.opticaId,
    linea: sp.linea,
    canal: sp.canal,
    desde: sp.desde,
    hasta: sp.hasta,
    page: sp.page,
    pageSize: '25',
  });
  const [data, opticas] = await Promise.all([
    serverApi<Paged<PedidoFila> & { resumen: PedidosResumen }>(`/admin/pedidos${query}`),
    serverApi<Paged<OpticaAdmin>>('/admin/opticas?pageSize=100'),
  ]);
  return (
    <PedidosTable
      data={data}
      opticas={opticas.items.map((o) => ({ id: o.id, nombre: o.nombre }))}
      exportHref={`/api/admin/pedidos/export.csv${query}`}
    />
  );
}
