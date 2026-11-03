import type { Metadata } from 'next';
import { PaginasLegalesTable } from '@/components/admin/legal/PaginasLegalesTable';
import { serverApiOrNull } from '@/lib/api-server';
import type { PaginaLegal } from '@/lib/admin/prompt6';

export const metadata: Metadata = { title: 'Páginas legales' };
export const dynamic = 'force-dynamic';

export default async function LegalPage() {
  const data = await serverApiOrNull<{ items: PaginaLegal[] }>('/admin/paginas-legales');
  return <PaginasLegalesTable items={data?.items ?? null} />;
}
