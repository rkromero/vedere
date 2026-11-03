import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Listado } from '@/components/tienda/catalogo/Listado';
import { catalogo } from '@/lib/tienda/api';
import type { SearchParams } from '@/lib/tienda/filtros';

async function getColeccion(slug: string) {
  const { items } = await catalogo.colecciones();
  return items.find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await getColeccion(slug);
  if (!c) return {};
  return {
    title: `Colección ${c.nombre}`,
    description: `Anteojos de la colección ${c.nombre} de Vedere. Comprás online y te los ajustan en tu óptica más cercana.`,
    alternates: { canonical: `/coleccion/${slug}` },
    openGraph: c.portadaUrl ? { images: [c.portadaUrl] } : undefined,
  };
}

export default async function ColeccionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const c = await getColeccion(slug);
  if (!c) notFound();
  return (
    <Listado
      titulo={c.nombre}
      descripcion={`Colección ${c.nombre}`}
      basePath={`/coleccion/${slug}`}
      ctx={{ coleccion: slug }}
      colorHex={c.colorHex}
      searchParams={await searchParams}
    />
  );
}
