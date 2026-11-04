import type { Metadata } from 'next';
import { NivelesReporte } from '@/components/admin/niveles/Niveles';
import { serverApi } from '@/lib/api-server';
import type { ReporteNiveles } from '@/lib/niveles';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Niveles de ópticas' };
export const dynamic = 'force-dynamic';

export default async function NivelesPage() {
  const [data, user] = await Promise.all([serverApi<ReporteNiveles>('/admin/niveles/reporte'), getSession()]);
  return <NivelesReporte data={data} esAdmin={user?.rol === 'ADMIN'} />;
}
