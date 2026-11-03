import type { Metadata } from 'next';
import { serverApiOrNull } from '@/lib/api-server';
import type { Direccion } from '@/lib/tienda/cuenta';
import { Tarjeta } from '@/components/tienda/cuenta/Tarjeta';
import { DireccionesManager } from '@/components/tienda/cuenta/DireccionesManager';

export const metadata: Metadata = { title: 'Direcciones' };
export const dynamic = 'force-dynamic';

export default async function DireccionesPage() {
  const data = await serverApiOrNull<{ items: Direccion[] }>('/cuenta/direcciones');
  return (
    <Tarjeta titulo="Mis direcciones">
      <DireccionesManager inicial={data?.items ?? []} error={!data} />
    </Tarjeta>
  );
}
