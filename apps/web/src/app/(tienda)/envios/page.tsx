import type { Metadata } from 'next';
import { formatARS } from '@vedere/ui';
import { site } from '@/config/site';
import { Pagina, Prose } from '@/components/tienda/Pagina';

export const metadata: Metadata = {
  title: 'Envíos y retiros',
  description: 'Retiro gratis en óptica socia o envío a domicilio a todo el país.',
  alternates: { canonical: '/envios' },
};

export default function EnviosPage() {
  return (
    <Pagina titulo="Envíos y retiros" intro="Elegís cómo recibirlo al finalizar la compra.">
      <Prose>
        <h2>Retiro en óptica socia (gratis)</h2>
        <p>
          Te asignamos la óptica más cercana a tu código postal. Cuando el pedido está listo te
          avisamos por mail y WhatsApp; pasás sin turno, te lo ajustan y te vas con los anteojos
          puestos. Anteojos de sol y accesorios: 2 a 4 días hábiles. Recetados y multifocales: 5 a
          10 días hábiles desde que la óptica recibe la receta.
        </p>
        <h2>Envío a domicilio</h2>
        <p>
          Enviamos a todo el país por correo con seguimiento. Gratis en compras desde{' '}
          {formatARS(site.comercial.envioGratisDesde)}; por debajo de ese monto el costo se calcula
          con tu código postal antes de pagar. AMBA: 2 a 4 días hábiles. Resto del país: 3 a 7 días
          hábiles, más el tiempo de armado si es recetado.
        </p>
        <h2>Seguimiento</h2>
        <p>
          En el mail de confirmación tenés el número de pedido y el estado se actualiza en cada
          paso: en preparación, en la óptica, en camino y entregado.
        </p>
      </Prose>
    </Pagina>
  );
}
