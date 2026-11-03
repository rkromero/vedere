import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@vedere/ui';
import { site } from '@/config/site';
import { Pagina, Prose } from '@/components/tienda/Pagina';
import { Markdown } from '@/components/tienda/legal/Markdown';
import { SolicitudCambioForm } from '@/components/tienda/cambios/SolicitudCambioForm';
import { paginaLegal } from '@/lib/tienda/api';

export const metadata: Metadata = {
  title: 'Cambios y devoluciones',
  description: 'Cambios por talle o color, devoluciones con reintegro y garantía de los anteojos Vedere.',
  alternates: { canonical: '/cambios-y-devoluciones' },
};

/** Política editable desde /admin/legal (slug `cambios`); si la API no responde, texto de respaldo. */
export default async function CambiosPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const [{ pedido }, pagina] = await Promise.all([searchParams, paginaLegal('cambios')]);
  const dias = site.comercial.diasCambio;
  return (
    <Pagina
      titulo={pagina?.titulo ?? 'Cambios y devoluciones'}
      intro={pagina?.intro ?? 'Queremos que te queden perfectos. Si no, lo resolvemos rápido y sin vueltas.'}
    >
      {pagina ? (
        <Markdown contenido={pagina.contenido} />
      ) : (
        <Prose>
          <h2>Cambios</h2>
          <p>
            Tenés <strong>{dias} días</strong> desde que recibís el pedido para cambiarlo por otro talle, color o
            modelo. El producto tiene que estar sin uso, con su estuche y etiquetas.
          </p>
          <h2>Devoluciones y reintegro</h2>
          <p>
            Dentro de los <strong>10 días corridos</strong> desde la entrega podés devolver el producto y pedir el
            reintegro total, sin dar explicaciones (botón de arrepentimiento, Ley 24.240).
          </p>
          <h2>Garantía</h2>
          <p>Los armazones tienen 6 meses de garantía por defectos de fabricación.</p>
          <h2>Ajustes</h2>
          <p>El ajuste en la óptica socia es gratis, siempre, aunque hayan pasado los {dias} días.</p>
        </Prose>
      )}
      <Prose className="mt-10">
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
