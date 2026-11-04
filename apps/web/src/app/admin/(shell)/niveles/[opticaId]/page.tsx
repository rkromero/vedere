import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NivelOpticaAdmin } from '@/components/admin/niveles/Niveles';
import { ServerApiError, serverApi } from '@/lib/api-server';
import type { PanelNivel } from '@/lib/niveles';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Nivel de la óptica' };
export const dynamic = 'force-dynamic';

export default async function NivelOpticaPage({ params }: { params: Promise<{ opticaId: string }> }) {
  const { opticaId } = await params;
  try {
    const [panel, user] = await Promise.all([serverApi<PanelNivel>(`/admin/niveles/opticas/${encodeURIComponent(opticaId)}`), getSession()]);
    return <NivelOpticaAdmin panel={panel} esAdmin={user?.rol === 'ADMIN'} />;
  } catch (err) {
    if (err instanceof ServerApiError && err.status === 404) notFound();
    throw err;
  }
}
