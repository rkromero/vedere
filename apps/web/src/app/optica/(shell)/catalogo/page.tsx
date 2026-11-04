import type { Metadata } from 'next';
import { CatalogoMayorista } from '@/components/optica/mayorista/CatalogoMayorista';
import type { Paged } from '@/components/admin/table';
import { serverApi } from '@/lib/api-server';
import type { CarritoMayorista, Condiciones, FiltrosMayorista, ProductoMayorista } from '@/lib/mayorista';

export const metadata: Metadata = { title: 'Catálogo mayorista' };
export const dynamic = 'force-dynamic';

const PARAMS = ['q', 'categoria', 'linea', 'forma', 'color', 'marca', 'coleccion', 'soloConStock', 'page'] as const;

export default async function CatalogoMayoristaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams({ pageSize: '24' });
  for (const k of PARAMS) {
    const v = Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k];
    if (v) q.set(k, v);
  }
  const [data, filtros, condiciones, carrito] = await Promise.all([
    serverApi<Paged<ProductoMayorista>>(`/optica/mayorista/productos?${q}`),
    serverApi<FiltrosMayorista>('/optica/mayorista/filtros'),
    serverApi<Condiciones>('/optica/mayorista/condiciones'),
    serverApi<CarritoMayorista>('/optica/mayorista/carrito'),
  ]);
  return <CatalogoMayorista data={data} filtros={filtros} condiciones={condiciones} unidadesCarrito={carrito.unidades} />;
}
