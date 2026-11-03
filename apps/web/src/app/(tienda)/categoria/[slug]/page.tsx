import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Listado } from '@/components/tienda/catalogo/Listado';
import { catalogo } from '@/lib/tienda/api';
import type { CategoriaNodo } from '@/lib/tienda/api';
import type { SearchParams } from '@/lib/tienda/filtros';

function buscar(nodos: CategoriaNodo[], slug: string): CategoriaNodo | null {
  for (const n of nodos) {
    if (n.slug === slug) return n;
    const h = n.hijas ? buscar(n.hijas, slug) : null;
    if (h) return h;
  }
  return null;
}

async function getCategoria(slug: string) {
  const { items } = await catalogo.categorias();
  return buscar(items, slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCategoria(slug);
  if (!c) return {};
  return {
    title: c.nombre,
    description: `${c.nombre}: anteojos Vedere. Comprás online y te los ajustan en tu óptica más cercana.`,
    alternates: { canonical: `/categoria/${slug}` },
  };
}

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const c = await getCategoria(slug);
  if (!c) notFound();
  return (
    <Listado
      titulo={c.nombre}
      basePath={`/categoria/${slug}`}
      ctx={{ categoria: slug }}
      searchParams={await searchParams}
    />
  );
}
