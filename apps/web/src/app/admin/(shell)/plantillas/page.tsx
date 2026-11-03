import type { Metadata } from 'next';
import { PlantillasTable } from '@/components/admin/plantillas/PlantillasTable';
import { serverApiOrNull } from '@/lib/api-server';
import type { PlantillaEmail } from '@/lib/admin/prompt6';

export const metadata: Metadata = { title: 'Plantillas de email' };
export const dynamic = 'force-dynamic';

export default async function PlantillasPage() {
  const data = await serverApiOrNull<{ items: PlantillaEmail[] }>('/admin/plantillas-email');
  return <PlantillasTable items={data?.items ?? null} />;
}
