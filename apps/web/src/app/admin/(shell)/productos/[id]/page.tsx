import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductoForm } from '@/components/admin/productos/ProductoForm';
import { serverApi, ServerApiError } from '@/lib/api-server';
import type { Categoria, Coleccion, Marca, Paged, Producto } from '@/lib/types';

export const metadata: Metadata = { title: 'Editar producto' };
export const dynamic = 'force-dynamic';

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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
    />
  );
}
