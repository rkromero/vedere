import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PaginaLegalEditor } from '@/components/admin/legal/PaginaLegalEditor';
import { serverApiOrNull } from '@/lib/api-server';
import type { PaginaLegal } from '@/lib/admin/prompt6';

export const metadata: Metadata = { title: 'Editar página legal' };
export const dynamic = 'force-dynamic';

export default async function PaginaLegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) notFound();
  const pagina = await serverApiOrNull<PaginaLegal>(`/admin/paginas-legales/${slug}`);
  if (!pagina) notFound();
  return <PaginaLegalEditor pagina={pagina} />;
}
