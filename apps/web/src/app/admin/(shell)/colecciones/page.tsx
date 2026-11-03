import type { Metadata } from 'next';
import { serverApi, qs } from '@/lib/api-server';
import type { Coleccion, Paged } from '@/lib/types';
import { ColeccionesTable } from '@/components/admin/catalogo/ColeccionesTable';

export const metadata: Metadata = { title: 'Colecciones' };
export const dynamic = 'force-dynamic';

export default async function ColeccionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = await serverApi<Paged<Coleccion>>(
    `/admin/colecciones${qs({ q: sp.q, activa: sp.activa, page: sp.page, pageSize: '20' })}`,
  );
  return <ColeccionesTable data={data} />;
}
