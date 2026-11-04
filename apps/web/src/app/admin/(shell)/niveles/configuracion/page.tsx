import type { Metadata } from 'next';
import { ConfigNivelesForm } from '@/components/admin/niveles/Niveles';
import { serverApi } from '@/lib/api-server';
import type { ConfigNiveles } from '@/lib/niveles';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Configuración de niveles' };
export const dynamic = 'force-dynamic';

export default async function ConfigNivelesPage() {
  const [data, user] = await Promise.all([serverApi<{ config: ConfigNiveles }>('/admin/niveles/config'), getSession()]);
  return <ConfigNivelesForm inicial={data.config} editable={user?.rol === 'ADMIN'} />;
}
