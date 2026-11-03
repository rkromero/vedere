import type { Metadata } from 'next';
import { ProductosTable } from '@/components/admin/productos/ProductosTable';
import { qs, serverApi } from '@/lib/api-server';
import type { Categoria, Coleccion, Marca, Paged, Producto } from '@/lib/types';

export const metadata: Metadata = { title: 'Productos' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

export default async function ProductosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const query = qs({
    q: sp.q,
    estado: sp.estado,
    linea: sp.linea,
    marcaId: sp.marcaId,
    categoriaId: sp.categoriaId,
    coleccionId: sp.coleccionId,
    bajoStock: sp.bajoStock,
    sort: sp.sort,
    page: sp.page,
    pageSize: '20',
  });

  const [data, marcas, categorias, colecciones] = await Promise.all([
    serverApi<Paged<Producto>>(`/admin/productos${query}`),
    serverApi<Paged<Marca>>('/admin/marcas?pageSize=100'),
    serverApi<{ items: Categoria[]; total: number }>('/admin/categorias'),
    serverApi<Paged<Coleccion>>('/admin/colecciones?pageSize=100'),
  ]);

  return (
    <ProductosTable
      data={data}
      marcas={marcas.items}
      categorias={categorias.items}
      colecciones={colecciones.items}
    />
  );
}
