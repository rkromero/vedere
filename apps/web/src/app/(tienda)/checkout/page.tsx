import type { Metadata } from 'next';
import { Checkout } from '@/components/tienda/checkout/Checkout';

export const metadata: Metadata = { title: 'Finalizar compra', robots: { index: false } };

// Siempre en el servidor: la config comercial (medios de pago, cuotas) debe ser la vigente y nunca la del build.
export const dynamic = 'force-dynamic';

/** Checkout en pasos (datos, entrega y óptica socia, receta, pago). El estado vive en el cliente: el carrito es local. */
export default function CheckoutPage() {
  return <Checkout />;
}
