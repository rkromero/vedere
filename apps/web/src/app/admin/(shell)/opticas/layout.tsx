// Pestañas de Ópticas socias: listado/mapa y solicitudes de alta (con la cantidad pendiente).
import { OpticasTabs } from '@/components/admin/opticas/OpticasTabs';
import { serverApiOrNull } from '@/lib/api-server';

export default async function OpticasLayout({ children }: { children: React.ReactNode }) {
  const pendientes = await serverApiOrNull<{ total: number }>('/admin/opticas/solicitudes?estado=PENDIENTE&pageSize=1');
  return (
    <>
      <OpticasTabs pendientes={pendientes?.total ?? 0} />
      {children}
    </>
  );
}
