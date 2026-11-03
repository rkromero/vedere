import type { Metadata } from 'next';
import { Gracias } from '@/components/tienda/checkout/Gracias';

export const metadata: Metadata = { title: 'Gracias por tu compra', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Confirmación del pedido. Mercado Pago vuelve acá con ?status=success|pending|failure. */
export default async function GraciasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ id }, { status }] = await Promise.all([params, searchParams]);
  return <Gracias id={id} status={status} />;
}
