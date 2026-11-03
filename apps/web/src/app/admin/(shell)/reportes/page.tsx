import type { Metadata } from 'next';
import { ReportesView } from '@/components/admin/reportes/ReportesView';
import { qs, serverApiOrNull } from '@/lib/api-server';
import type { Reporte } from '@/lib/admin/prompt6';
import { fechaISO } from '@/lib/admin/prompt6';

export const metadata: Metadata = { title: 'Reportes' };
export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const desdeRaw = Array.isArray(sp.desde) ? sp.desde[0] : sp.desde;
  const hastaRaw = Array.isArray(sp.hasta) ? sp.hasta[0] : sp.hasta;
  const desde = desdeRaw && ISO.test(desdeRaw) ? desdeRaw : fechaISO(-29);
  const hasta = hastaRaw && ISO.test(hastaRaw) ? hastaRaw : fechaISO(0);
  const query = qs({ desde, hasta });
  const reporte = await serverApiOrNull<Reporte>(`/admin/reportes${query}`);
  return (
    <ReportesView
      reporte={reporte}
      desde={desde}
      hasta={hasta}
      csvPedidosHref={`/api/admin/reportes/csv${qs({ desde, hasta, tipo: 'pedidos' })}`}
      csvItemsHref={`/api/admin/reportes/csv${qs({ desde, hasta, tipo: 'items' })}`}
    />
  );
}
