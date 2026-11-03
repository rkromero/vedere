import type { Metadata } from 'next';
import { SolicitudesTable } from '@/components/admin/solicitudes/SolicitudesTable';
import { qs, serverApi } from '@/lib/api-server';
import type { SolicitudFila } from '@/lib/pedidos';
import type { Paged } from '@/lib/types';

export const metadata: Metadata = { title: 'Cambios y devoluciones' };
export const dynamic = 'force-dynamic';

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = await serverApi<Paged<SolicitudFila> & { pendientes: number }>(
    `/admin/solicitudes${qs({ estado: sp.estado, tipo: sp.tipo, page: sp.page, pageSize: '25' })}`,
  );
  return <SolicitudesTable data={data} />;
}
