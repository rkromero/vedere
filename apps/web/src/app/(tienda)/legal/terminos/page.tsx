import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/config/site';
import { Pagina, Prose } from '@/components/tienda/Pagina';

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description: 'Condiciones de uso y de compra en Vedere.',
  alternates: { canonical: '/legal/terminos' },
};

export default function TerminosPage() {
  return (
    <Pagina titulo="Términos y condiciones" intro="Última actualización: noviembre de 2026.">
      <Prose>
        <h2>1. Quiénes somos</h2>
        <p>
          Vedere es una tienda online de anteojos de sol, recetados, multifocales y accesorios que
          opera en la República Argentina. Los pedidos se arman, entregan y ajustan a través de
          ópticas socias independientes, matriculadas y habilitadas.
        </p>
        <h2>2. Compras</h2>
        <p>
          Los precios están expresados en pesos argentinos e incluyen IVA. Las promociones, cuotas
          y cupones son válidos mientras estén publicados y pueden tener condiciones particulares
          (monto mínimo, cantidad de usos, vigencia). El pedido queda confirmado cuando se acredita
          el pago. Si un producto no tuviera stock, te lo informamos y podés elegir otro o pedir el
          reintegro total.
        </p>
        <h2>3. Lentes graduados</h2>
        <p>
          Los lentes recetados se elaboran según la receta que vos nos entregás, emitida por un
          profesional habilitado y con menos de un año de antigüedad. La óptica socia puede
          solicitar una verificación de la receta. Los productos graduados a medida no admiten
          devolución por arrepentimiento, salvo defecto de fabricación, conforme al artículo 34 de
          la Ley 24.240 y normas complementarias.
        </p>
        <h2>4. Envíos y entregas</h2>
        <p>
          Podés retirar sin cargo en la óptica socia asignada o pedir envío a domicilio. Los plazos
          informados son estimados y se cuentan en días hábiles desde la acreditación del pago o la
          recepción de la receta.
        </p>
        <h2>5. Cambios, devoluciones y garantía</h2>
        <p>
          Se rigen por nuestra{' '}
          <Link href="/cambios-y-devoluciones">política de cambios y devoluciones</Link> y por la Ley de
          Defensa del Consumidor. El botón de arrepentimiento está disponible en{' '}
          <Link href="/legal/arrepentimiento">/legal/arrepentimiento</Link> durante los 10 días corridos
          posteriores a la entrega.
        </p>
        <h2>6. Propiedad intelectual</h2>
        <p>
          Las marcas, fotos, textos y diseños de este sitio pertenecen a Vedere o a sus licenciantes
          y no pueden reproducirse sin autorización.
        </p>
        <h2>7. Datos personales</h2>
        <p>
          Tratamos tus datos según nuestra <Link href="/legal/privacidad">política de privacidad</Link> y
          la Ley 25.326 de Protección de Datos Personales.
        </p>
        <h2>8. Contacto y jurisdicción</h2>
        <p>
          Para consultas o reclamos escribinos a <a href={`mailto:${site.emailContacto}`}>{site.emailContacto}</a>.
          Estos términos se rigen por las leyes de la República Argentina. Ante cualquier
          controversia, podés acudir a la Dirección Nacional de Defensa del Consumidor
          (www.argentina.gob.ar/defensadelconsumidor) o a la justicia ordinaria de tu domicilio.
        </p>
      </Prose>
    </Pagina>
  );
}
