import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@vedere/ui';
import { site } from '@/config/site';
import { Pagina, Prose } from '@/components/tienda/Pagina';

export const metadata: Metadata = {
  title: 'Cambios y devoluciones',
  description: 'Cambios por talle o color, devoluciones con reintegro y garantía de los anteojos Vedere.',
  alternates: { canonical: '/cambios-y-devoluciones' },
};

export default function CambiosPage() {
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

        <h2>¿Cómo pido un cambio?</h2>
        <ol>
          <li>Escribinos desde el formulario con tu número de pedido.</li>
          <li>Te confirmamos la óptica donde hacerlo o coordinamos el retiro.</li>
          <li>Listo: el cambio o reintegro se procesa en hasta 10 días hábiles.</li>
        </ol>
      </Prose>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/contacto?motivo=cambio" className={buttonClasses('primary')}>
          Pedir un cambio
        </Link>
        <Link href="/legal/arrepentimiento" className={buttonClasses('secondary')}>
          Botón de arrepentimiento
        </Link>
      </div>
    </Pagina>
  );
}
