import type { Metadata } from 'next';
import { NewsletterView } from '@/components/admin/newsletter/NewsletterView';
import { qs, serverApiOrNull } from '@/lib/api-server';
import type { SuscriptorNewsletter } from '@/lib/admin/prompt6';
import type { Paged } from '@/lib/types';

export const metadata: Metadata = { title: 'Newsletter' };
export const dynamic = 'force-dynamic';

export default async function NewsletterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const query = qs({ q: sp.q, estado: sp.estado, page: sp.page, pageSize: '25' });
  const data = await serverApiOrNull<Paged<SuscriptorNewsletter> & { resumen?: { activos: number; bajas: number } }>(
    `/admin/newsletter${query}`,
  );
  return <NewsletterView data={data} csvHref={`/api/admin/newsletter/csv${qs({ q: sp.q, estado: sp.estado })}`} />;
}
