import type { Metadata } from 'next';
import { DevolucionesMayoristas } from '@/components/admin/mayorista/PedidosMayoristas';
import type { Paged } from '@/components/admin/table';
import { qs, serverApi } from '@/lib/api-server';
import type { DevolucionMayorista } from '@/lib/mayorista';

export const metadata: Metadata = { title: 'Devoluciones mayoristas' };
export const dynamic = 'force-dynamic';

export default async function DevolucionesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const data = await serverApi<Paged<DevolucionMayorista> & { resumen: Partial<Record<string, number>> }>(
    `/admin/mayorista/devoluciones${qs({ estado: typeof sp.estado === 'string' ? sp.estado : undefined, page: typeof sp.page === 'string' ? sp.page : undefined, pageSize: '25' })}`,
  );
  return <DevolucionesMayoristas data={data} />;
}
