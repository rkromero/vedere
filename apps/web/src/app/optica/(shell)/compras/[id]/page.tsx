import type { Metadata } from 'next';
import { forbidden, notFound } from 'next/navigation';
import { CompraDetalle } from '@/components/optica/mayorista/Compras';
import { ServerApiError, serverApi } from '@/lib/api-server';
import type { PedidoMayorista } from '@/lib/mayorista';

export const dynamic = 'force-dynamic';

/** Pedido mayorista de la óptica. Si es de otra, la API responde 403 y la página también (forbidden()). */
async function cargar(id: string) {
  try {
    return await serverApi<PedidoMayorista>(`/optica/mayorista/pedidos/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ServerApiError && err.status === 404) notFound();
    if (err instanceof ServerApiError && err.status === 403) forbidden();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await cargar(id);
  return { title: `Pedido ${p.numero}` };
}

export default async function CompraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <CompraDetalle pedido={await cargar(id)} nuevo={sp.nuevo === '1'} />;
}
