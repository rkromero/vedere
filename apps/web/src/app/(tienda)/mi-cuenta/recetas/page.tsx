import type { Metadata } from 'next';
import { serverApiOrNull } from '@/lib/api-server';
import type { Receta } from '@/lib/tienda/checkout';
import { Tarjeta } from '@/components/tienda/cuenta/Tarjeta';
import { RecetasLista } from '@/components/tienda/cuenta/RecetasLista';

export const metadata: Metadata = { title: 'Recetas' };
export const dynamic = 'force-dynamic';

export default async function RecetasPage() {
  const data = await serverApiOrNull<{ items: Receta[] }>('/cuenta/recetas');
  return (
    <Tarjeta titulo="Recetas guardadas">
      <RecetasLista inicial={data?.items ?? []} error={!data} />
    </Tarjeta>
  );
}
