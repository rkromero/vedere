import type { Metadata } from 'next';
import { site } from '@/config/site';
import { Pagina, Prose } from '@/components/tienda/Pagina';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Qué datos recopila Vedere, para qué los usa y cómo podés ejercer tus derechos.',
  alternates: { canonical: '/legal/privacidad' },
};

export default function PrivacidadPage() {
  return (
    <Pagina titulo="Privacidad" intro="Tus datos son tuyos. Acá te contamos qué hacemos con ellos.">
      <Prose>
        <h2>Qué datos recopilamos</h2>
        <ul>
          <li>Datos de contacto y entrega: nombre, email, teléfono, dirección y código postal.</li>
          <li>Datos de compra: productos, pagos (procesados por Mercado Pago; no guardamos tu tarjeta).</li>
          <li>Receta óptica, sólo si elegís comprar lentes graduados. Es un dato sensible: lo tratamos con confidencialidad y lo compartimos únicamente con la óptica socia que arma tu pedido.</li>
          <li>Datos de navegación: carrito, productos vistos y preferencias, guardados en tu dispositivo.</li>
        </ul>
        <h2>Para qué los usamos</h2>
        <ul>
          <li>Procesar y entregar tu pedido, y coordinar el ajuste en la óptica socia.</li>
          <li>Responder consultas, turnos, cambios y garantías.</li>
          <li>Enviarte novedades sólo si te suscribiste; podés darte de baja desde cualquier mail.</li>
          <li>Mejorar la tienda con estadísticas anónimas de uso.</li>
        </ul>
        <h2>Con quién los compartimos</h2>
        <p>
          Con la óptica socia asignada a tu pedido, con el correo o logística que realiza el envío y
          con el procesador de pagos. Nunca vendemos tus datos.
        </p>
        <h2>Tus derechos</h2>
        <p>
          Podés acceder, rectificar o suprimir tus datos escribiendo a{' '}
          <a href={`mailto:${site.emailContacto}`}>{site.emailContacto}</a>. La Agencia de Acceso a
          la Información Pública, órgano de control de la Ley 25.326, tiene la atribución de atender
          las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas
          sobre protección de datos personales.
        </p>
        <h2>Cookies y almacenamiento local</h2>
        <p>
          Usamos almacenamiento del navegador para recordar tu carrito y los productos que viste, y
          cookies estrictamente necesarias para la sesión si iniciás sesión. No usamos cookies de
          publicidad de terceros.
        </p>
      </Prose>
    </Pagina>
  );
}
