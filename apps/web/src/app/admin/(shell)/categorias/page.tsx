import type { Metadata } from 'next';
import { serverApi } from '@/lib/api-server';
import type { Categoria } from '@/lib/types';
import { CategoriasTree } from '@/components/admin/catalogo/CategoriasTree';

export const metadata: Metadata = { title: 'Categorías' };
export const dynamic = 'force-dynamic';

export default async function CategoriasPage() {
  const data = await serverApi<{ items: Categoria[]; total: number }>(
    '/admin/categorias?tree=true',
  );
  return <CategoriasTree tree={data.items} />;
}
