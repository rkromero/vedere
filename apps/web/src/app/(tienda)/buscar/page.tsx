import type { Metadata } from 'next';
import { Listado } from '@/components/tienda/catalogo/Listado';
import type { SearchParams } from '@/lib/tienda/filtros';

export const metadata: Metadata = {
  title: 'Buscar',
  robots: { index: false, follow: true },
};

export default async function BuscarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 120) ?? '';
  return (
    <Listado
      titulo={q ? `“${q}”` : 'Buscar'}
      descripcion={q ? 'Resultados de tu búsqueda' : 'Escribí qué estás buscando.'}
      basePath="/buscar"
      ctx={{ q, orden: 'relevancia' }}
      searchParams={sp}
    />
  );
}
