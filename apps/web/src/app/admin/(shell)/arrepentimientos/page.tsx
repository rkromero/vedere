import type { Metadata } from 'next';
import { ArrepentimientosView } from '@/components/admin/arrepentimientos/ArrepentimientosView';
import { qs, serverApiOrNull } from '@/lib/api-server';
import type { Arrepentimiento, ResumenArrepentimientos } from '@/lib/admin/prompt6';
import type { Paged } from '@/lib/types';

export const metadata: Metadata = { title: 'Arrepentimientos' };
export const dynamic = 'force-dynamic';

export default async function ArrepentimientosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = await serverApiOrNull<Paged<Arrepentimiento> & { resumen?: ResumenArrepentimientos }>(
    `/admin/arrepentimientos${qs({ estado: sp.estado, q: sp.q, page: sp.page, pageSize: '25' })}`,
  );
  return <ArrepentimientosView data={data} />;
}
