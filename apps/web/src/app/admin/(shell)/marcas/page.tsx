import type { Metadata } from 'next';
import { serverApi, qs } from '@/lib/api-server';
import type { Marca, Paged } from '@/lib/types';
import { MarcasTable } from '@/components/admin/catalogo/MarcasTable';

export const metadata: Metadata = { title: 'Marcas' };
export const dynamic = 'force-dynamic';

export default async function MarcasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = await serverApi<Paged<Marca>>(
    `/admin/marcas${qs({ q: sp.q, activa: sp.activa, page: sp.page, pageSize: '20' })}`,
  );
  return <MarcasTable data={data} />;
}
