import type { Metadata } from 'next';
import { serverApi } from '@/lib/api-server';
import type { PromoMensajeAdmin } from '@/lib/types';
import { PromosTable } from '@/components/admin/tienda/PromosTable';

export const metadata: Metadata = { title: 'Barra de promo' };
export const dynamic = 'force-dynamic';

export default async function PromosPage() {
  const { items } = await serverApi<{ items: PromoMensajeAdmin[] }>('/admin/promos');
  return <PromosTable items={items} />;
}
