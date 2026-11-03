import type { Metadata } from 'next';
import { OpticaPedidosTable } from '@/components/optica/OpticaPedidosTable';
import { qs, serverApi } from '@/lib/api-server';
import type { PedidoOpticaFila } from '@/lib/pedidos';
import type { Paged } from '@/lib/types';

export const metadata: Metadata = { title: 'Pedidos' };
export const dynamic = 'force-dynamic';

export default async function OpticaPedidosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = await serverApi<Paged<PedidoOpticaFila> & { resumen: Partial<Record<string, number>> }>(
    `/optica/pedidos${qs({ q: sp.q, estado: sp.estado, desde: sp.desde, hasta: sp.hasta, page: sp.page, pageSize: '25' })}`,
  );
  return <OpticaPedidosTable data={data} />;
}
