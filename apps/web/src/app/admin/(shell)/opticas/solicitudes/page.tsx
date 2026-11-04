import type { Metadata } from 'next';
import { SolicitudesOpticaTable } from '@/components/admin/opticas/SolicitudesOpticaTable';
import { qs, serverApi } from '@/lib/api-server';
import type { EstadoSolicitudOptica, Paged, SolicitudOptica } from '@/lib/types';

export const metadata: Metadata = { title: 'Solicitudes de ópticas' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

export default async function SolicitudesOpticaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  // Por defecto se ven las pendientes; ?estado=todas muestra todo.
  const estado = typeof sp.estado === 'string' ? sp.estado : 'PENDIENTE';
  const data = await serverApi<Paged<SolicitudOptica> & { resumen: Partial<Record<EstadoSolicitudOptica, number>> }>(
    `/admin/opticas/solicitudes${qs({
      estado: estado === 'todas' ? undefined : estado,
      q: sp.q,
      page: sp.page,
      pageSize: '20',
    })}`,
  );
  return <SolicitudesOpticaTable data={data} resumen={data.resumen} estado={estado} />;
}
