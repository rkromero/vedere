import type { Metadata } from 'next';
import { serverApi, qs } from '@/lib/api-server';
import type { Cupon, Paged } from '@/lib/types';
import { CuponesTable } from '@/components/admin/tienda/CuponesTable';

export const metadata: Metadata = { title: 'Cupones' };
export const dynamic = 'force-dynamic';

export default async function CuponesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = await serverApi<Paged<Cupon>>(
    `/admin/cupones${qs({ q: sp.q, activo: sp.activo, page: sp.page, pageSize: '20' })}`,
  );
  return <CuponesTable data={data} />;
}
