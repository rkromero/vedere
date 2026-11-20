import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductoForm } from '@/components/admin/productos/ProductoForm';
import { serverApi, ServerApiError } from '@/lib/api-server';
import type { Categoria, Coleccion, Marca, Paged, Producto } from '@/lib/types';

export const metadata: Metadata = { title: 'Editar producto' };
export const dynamic = 'force-dynamic';

export default async function EditarProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  // ?codigo=: agregar una variante nueva (otro color del mismo modelo) desde un código escaneado.
  const codigo = typeof sp.codigo === 'string' ? sp.codigo : undefined;

  let producto: Producto;
  try {
    producto = await serverApi<Producto>(`/admin/productos/${id}`);
  } catch (err) {
    if (err instanceof ServerApiError && err.status === 404) notFound();
    throw err;
  }

  const [marcas, categorias, colecciones] = await Promise.all([
    serverApi<Paged<Marca>>('/admin/marcas?pageSize=100'),
    serverApi<{ items: Categoria[]; total: number }>('/admin/categorias'),
    serverApi<Paged<Coleccion>>('/admin/colecciones?pageSize=100'),
  ]);

  return (
    <ProductoForm
      key={producto.id}
      producto={producto}
      marcas={marcas.items}
      categorias={categorias.items}
      colecciones={colecciones.items}
      codigoInicial={codigo}
      abrirFoto={sp.foto === '1'}
    />
  );
}
