import type { Metadata } from 'next';
import { serverApi, qs } from '@/lib/api-server';
import type { OpticaAdmin, Paged } from '@/lib/types';
import { OpticasTable } from '@/components/admin/tienda/OpticasTable';

export const metadata: Metadata = { title: 'Ópticas socias' };
export const dynamic = 'force-dynamic';

export default async function OpticasAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const [data, todas] = await Promise.all([
    serverApi<Paged<OpticaAdmin>>(
      `/admin/opticas${qs({
        q: sp.q,
        activa: sp.activa,
        provincia: sp.provincia,
        page: sp.page,
        pageSize: '20',
      })}`,
    ),
    serverApi<Paged<OpticaAdmin>>('/admin/opticas?pageSize=100'),
  ]);
  const provincias = Array.from(new Set(todas.items.map((o) => o.provincia))).sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
  return <OpticasTable data={data} provincias={provincias} />;
}
