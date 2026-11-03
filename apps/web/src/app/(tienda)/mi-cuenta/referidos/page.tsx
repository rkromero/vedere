import type { Metadata } from 'next';
import { serverApiOrNull } from '@/lib/api-server';
import type { Referidos } from '@/lib/tienda/cuenta';
import { ReferidosPanel } from '@/components/tienda/cuenta/ReferidosPanel';

export const metadata: Metadata = { title: 'Referidos' };
export const dynamic = 'force-dynamic';

export default async function ReferidosPage() {
  const data = await serverApiOrNull<Referidos>('/cuenta/referidos');
  return <ReferidosPanel data={data} />;
}
