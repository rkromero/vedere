import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@vedere/ui';
import { site } from '@/config/site';
import { Pagina, Prose } from '@/components/tienda/Pagina';
import { SolicitudCambioForm } from '@/components/tienda/cambios/SolicitudCambioForm';

export const metadata: Metadata = {
  title: 'Cambios y devoluciones',
  description: 'Cambios por talle o color, devoluciones con reintegro y garantía de los anteojos Vedere.',
  alternates: { canonical: '/cambios-y-devoluciones' },
};

export default async function CambiosPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { pedido } = await searchParams;
  const dias = site.comercial.diasCambio;
  return (
    <Pagina
      titulo="Cambios y devoluciones"
      intro="Queremos que te queden perfectos. Si no, lo resolvemos rápido y sin vueltas."
    >
      <Prose>
        <h2>Cambios</h2>
        <p>
          Tenés <strong>{dias} días</strong> desde que recibís el pedido para cambiarlo por otro
          talle, color o modelo. El producto tiene que estar sin uso, con su estuche y etiquetas.
        </p>
        <ul>
          <li>El primer cambio es gratis: lo hacés en cualquier óptica socia o te lo pasamos a buscar.</li>
          <li>Si el nuevo modelo cuesta más, abonás la diferencia; si cuesta menos, te damos una nota de crédito.</li>
          <li>Los lentes graduados a medida no se cambian por otro armazón, salvo defecto de fabricación.</li>
        </ul>

        <h2>Devoluciones y reintegro</h2>
        <p>
          Dentro de los <strong>10 días corridos</strong> desde la entrega podés devolver el producto
          y pedir el reintegro total, sin dar explicaciones (botón de arrepentimiento, Ley 24.240).
          El reintegro se acredita en el mismo medio de pago en un plazo de hasta 10 días hábiles.
        </p>

        <h2>Garantía</h2>
        <p>
          Los armazones tienen <strong>6 meses de garantía</strong> por defectos de fabricación:
          bisagras, soldaduras, pintura o acetato. No cubre golpes, rayas ni uso indebido. Los
          lentes orgánicos con antirreflejo tienen 3 meses de garantía contra descascarado.
        </p>

        <h2>Ajustes</h2>
        <p>
          El ajuste en la óptica socia es gratis, siempre, aunque hayan pasado los {dias} días.
          Pasá sin turno con tus anteojos y el número de pedido.
        </p>

        <h2>¿Cómo pido un cambio o una devolución?</h2>
        <ol>
          <li>Buscá tu pedido acá abajo con el número y el email de la compra.</li>
          <li>Elegí cambio o devolución y contanos el motivo.</li>
          <li>Te confirmamos por email: un pedido nuevo sin cargo o el reintegro en hasta 10 días hábiles.</li>
        </ol>
      </Prose>
      <div id="solicitud" className="mt-10 scroll-mt-24">
        <SolicitudCambioForm numeroInicial={pedido ?? ''} />
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/contacto?motivo=cambio" className={buttonClasses('secondary')}>
          Tengo otra consulta
        </Link>
        <Link href="/legal/arrepentimiento" className={buttonClasses('secondary')}>
          Botón de arrepentimiento
        </Link>
      </div>
    </Pagina>
  );
}
