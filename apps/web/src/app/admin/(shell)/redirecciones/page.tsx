import type { Metadata } from 'next';
import { RedireccionesView } from '@/components/admin/redirecciones/RedireccionesView';
import { serverApiOrNull } from '@/lib/api-server';
import { requireAdmin } from '@/lib/session';
import type { Redireccion } from '@/lib/admin/prompt6';

export const metadata: Metadata = { title: 'Redirecciones' };
export const dynamic = 'force-dynamic';

export default async function RedireccionesPage() {
  await requireAdmin('/admin/redirecciones');
  const data = await serverApiOrNull<{ items: Redireccion[] }>('/admin/redirecciones');
  return <RedireccionesView items={data?.items ?? null} />;
}
