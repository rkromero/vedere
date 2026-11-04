import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FichaMayorista } from '@/components/optica/mayorista/FichaMayorista';
import { ServerApiError, serverApi } from '@/lib/api-server';
import type { ProductoMayorista } from '@/lib/mayorista';

export const dynamic = 'force-dynamic';

async function cargar(slug: string) {
  try {
    return await serverApi<ProductoMayorista>(`/optica/mayorista/productos/${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err instanceof ServerApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await cargar(slug);
  return { title: p.nombre };
}

export default async function FichaMayoristaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <FichaMayorista producto={await cargar(slug)} />;
}
