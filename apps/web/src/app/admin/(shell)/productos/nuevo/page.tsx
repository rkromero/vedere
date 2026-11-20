import type { Metadata } from 'next';
import { ProductoForm } from '@/components/admin/productos/ProductoForm';
import { serverApi } from '@/lib/api-server';
import type { Categoria, Coleccion, Marca, Paged } from '@/lib/types';

export const metadata: Metadata = { title: 'Nuevo producto' };
export const dynamic = 'force-dynamic';

export default async function NuevoProductoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const codigo = typeof sp.codigo === 'string' ? sp.codigo : undefined;
  const [marcas, categorias, colecciones] = await Promise.all([
    serverApi<Paged<Marca>>('/admin/marcas?pageSize=100'),
    serverApi<{ items: Categoria[]; total: number }>('/admin/categorias'),
    serverApi<Paged<Coleccion>>('/admin/colecciones?pageSize=100'),
  ]);

  return (
    <ProductoForm
      producto={null}
      marcas={marcas.items}
      categorias={categorias.items}
      colecciones={colecciones.items}
      codigoInicial={codigo}
    />
  );
}
