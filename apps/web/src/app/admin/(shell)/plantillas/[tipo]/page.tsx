import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlantillaEditor } from '@/components/admin/plantillas/PlantillaEditor';
import { serverApiOrNull } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import type { PlantillaEmail } from '@/lib/admin/prompt6';

export const metadata: Metadata = { title: 'Editar plantilla' };
export const dynamic = 'force-dynamic';

export default async function PlantillaPage({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!/^[A-Z0-9_]{3,60}$/.test(tipo)) notFound();
  const [plantilla, user] = await Promise.all([
    serverApiOrNull<PlantillaEmail>(`/admin/plantillas-email/${tipo}`),
    getSession(),
  ]);
  if (!plantilla) notFound();
  return <PlantillaEditor plantilla={plantilla} emailUsuario={user?.email ?? ''} />;
}
