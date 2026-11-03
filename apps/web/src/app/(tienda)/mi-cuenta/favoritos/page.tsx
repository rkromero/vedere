import type { Metadata } from 'next';
import { serverApiOrNull } from '@/lib/api-server';
import type { Producto } from '@/lib/types';
import { Tarjeta } from '@/components/tienda/cuenta/Tarjeta';
import { FavoritosGrid } from '@/components/tienda/cuenta/FavoritosGrid';

export const metadata: Metadata = { title: 'Favoritos' };
export const dynamic = 'force-dynamic';

export default async function FavoritosPage() {
  const data = await serverApiOrNull<{ items: Producto[] }>('/cuenta/favoritos');
  return (
    <Tarjeta titulo="Mis favoritos">
      <FavoritosGrid inicial={data?.items ?? []} error={!data} />
    </Tarjeta>
  );
}
