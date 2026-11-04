import type { Metadata } from 'next';
import { NivelPanel } from '@/components/niveles/NivelPanel';
import { PageHeader } from '@/components/admin/ui';
import { serverApi } from '@/lib/api-server';
import type { PanelNivel } from '@/lib/niveles';

export const metadata: Metadata = { title: 'Mi nivel' };
export const dynamic = 'force-dynamic';

export default async function NivelPage() {
  const panel = await serverApi<PanelNivel>('/optica/nivel');
  return (
    <>
      <PageHeader title="Mi nivel" description="Tu nivel en la red Vedere, cómo se calcula y qué te conviene mover para subir." />
      <NivelPanel panel={panel} modo="optica" />
    </>
  );
}
