import type { Metadata } from 'next';
import { Checkout } from '@/components/tienda/checkout/Checkout';

export const metadata: Metadata = { title: 'Finalizar compra', robots: { index: false } };

/** Checkout en pasos (datos, entrega y óptica socia, receta, pago). El estado vive en el cliente: el carrito es local. */
export default function CheckoutPage() {
  return <Checkout />;
}
