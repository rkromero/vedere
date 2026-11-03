import type { Metadata } from 'next';
import Link from 'next/link';
import { Pagina, Prose } from '@/components/tienda/Pagina';
import { ArrepentimientoForm } from '@/components/tienda/legal/ArrepentimientoForm';

export const metadata: Metadata = {
  title: 'Botón de arrepentimiento',
  description:
    'Revocá tu compra dentro de los 10 días corridos desde la entrega, sin costo ni explicaciones. Recibís un número de trámite al instante.',
  alternates: { canonical: '/legal/arrepentimiento' },
};

export default async function ArrepentimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { pedido } = await searchParams;
  return (
    <Pagina
      titulo="Botón de arrepentimiento"
      intro="Podés revocar la compra dentro de los 10 días corridos desde que recibiste el pedido, sin costo ni explicaciones. Al enviar la solicitud recibís un número de trámite."
      aside={
        <div className="rounded-3xl bg-gris-claro p-5 text-sm leading-relaxed">
          <h2 className="font-semibold">Qué dice la ley</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-negro/80">
            <li>
              <strong>Art. 34, Ley 24.240:</strong> en ventas a distancia tenés derecho a revocar la compra
              durante 10 días corridos desde la entrega o la celebración del contrato, lo que ocurra después.
            </li>
            <li>
              <strong>Res. 424/2020 (Secretaría de Comercio Interior):</strong> el botón tiene que estar
              visible en el sitio, la solicitud no puede exigir registro y recibís un número de trámite dentro de
              las 24 horas.
            </li>
            <li>La devolución es sin costo para vos y el reintegro va por el mismo medio de pago.</li>
            <li>
              Los lentes graduados a medida quedan excluidos, salvo defecto de fabricación (art. 1110 y 1116 del
              Código Civil y Comercial).
            </li>
          </ul>
          <p className="mt-4 text-negro/70">
            Si preferís un cambio por otro modelo, usá{' '}
            <Link href="/cambios-y-devoluciones" className="underline underline-offset-4">
              cambios y devoluciones
            </Link>
            .
          </p>
        </div>
      }
    >
      <Prose className="mb-8">
        <p>
          Completá el formulario con el email de la compra y, si lo tenés a mano, el número de pedido. Te
          respondemos dentro de las 24 horas hábiles con las instrucciones para la devolución; el reintegro se
          acredita en el mismo medio de pago en hasta 10 días hábiles desde que recibimos el producto.
        </p>
      </Prose>
      <ArrepentimientoForm pedidoInicial={pedido ?? ''} />
    </Pagina>
  );
}
