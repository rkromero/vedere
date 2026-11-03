import type { Metadata } from 'next';
import { ContactoForm } from '@/components/tienda/ContactoForm';
import { Pagina, Prose } from '@/components/tienda/Pagina';

export const metadata: Metadata = {
  title: 'Botón de arrepentimiento',
  description: 'Revocá tu compra dentro de los 10 días corridos desde la entrega, sin costo.',
  alternates: { canonical: '/legal/arrepentimiento' },
};

export default function ArrepentimientoPage() {
  return (
    <Pagina
      titulo="Botón de arrepentimiento"
      intro="Podés revocar la compra dentro de los 10 días corridos desde que recibiste el pedido, sin costo ni explicaciones (art. 34, Ley 24.240 y Res. 424/2020)."
    >
      <Prose className="mb-8">
        <p>
          Completá el formulario con tu número de pedido. Te respondemos dentro de las 24 horas
          hábiles con las instrucciones para la devolución y el reintegro se acredita en el mismo
          medio de pago. Los lentes graduados a medida quedan excluidos, salvo defecto.
        </p>
      </Prose>
      <ContactoForm motivoInicial="ARREPENTIMIENTO" conPedido />
    </Pagina>
  );
}
