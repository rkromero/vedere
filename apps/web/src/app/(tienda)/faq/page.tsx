import type { Metadata } from 'next';
import Link from 'next/link';
import { Disclosure, formatARS } from '@vedere/ui';
import { site } from '@/config/site';
import { Pagina } from '@/components/tienda/Pagina';

export const metadata: Metadata = {
  title: 'Preguntas frecuentes',
  description: 'Todo lo que necesitás saber para comprar anteojos en Vedere.',
  alternates: { canonical: '/faq' },
};

const GRUPOS = [
  {
    titulo: 'Comprar',
    items: [
      {
        q: '¿Cómo funciona Vedere?',
        a: 'Elegís el modelo y el color online. Nosotros derivamos el pedido a la óptica socia más cercana a tu domicilio: ahí lo arman, te lo entregan y te lo ajustan a la cara. Si preferís, te lo enviamos a domicilio.',
      },
      {
        q: '¿Puedo pagar en cuotas?',
        a: `Sí. ${site.comercial.cuotas} cuotas sin interés con tarjetas bancarias y todos los medios de pago de Mercado Pago. El precio que ves es el precio final.`,
      },
      {
        q: '¿Necesito una cuenta para comprar?',
        a: 'No. Podés comprar como invitado con tu email. Si creás una cuenta, tu carrito y tus recetas quedan guardados para la próxima.',
      },
    ],
  },
  {
    titulo: 'Recetados y multifocales',
    items: [
      {
        q: '¿Cómo cargo mi receta?',
        a: 'Al comprar un armazón recetado marcás "Usar con mi receta". Después del pago podés subir una foto de la receta o llevarla en papel a la óptica socia. La receta tiene que tener menos de un año.',
      },
      {
        q: '¿Qué lentes incluye el precio?',
        a: 'El armazón incluye lentes orgánicos con tratamiento antirreflejo para graduaciones de hasta ±4 esférico. Graduaciones más altas, lentes finos o fotocromáticos se cotizan en la óptica.',
      },
      {
        q: '¿Cuánto tarda un recetado?',
        a: 'Entre 5 y 10 días hábiles desde que la óptica recibe la receta. Te avisamos por mail y WhatsApp cuando esté listo.',
      },
      {
        q: 'No me adapto a los multifocales, ¿qué hago?',
        a: 'Volvé a la óptica dentro de los 30 días: revisan el centrado y la altura. Si aun así no te adaptás, cambiamos los lentes por monofocales sin cargo.',
      },
    ],
  },
  {
    titulo: 'Envíos, cambios y garantía',
    items: [
      {
        q: '¿Cuánto cuesta el envío?',
        a: `El retiro en óptica socia es gratis. El envío a domicilio es gratis desde ${formatARS(site.comercial.envioGratisDesde)}; por debajo se calcula al finalizar la compra según tu código postal.`,
      },
      {
        q: '¿Puedo cambiarlos si no me quedan?',
        a: `Sí, tenés ${site.comercial.diasCambio} días para cambios por talle o color y 10 días para devolución con reintegro (botón de arrepentimiento). Los lentes graduados a medida no admiten devolución, salvo defecto.`,
      },
      {
        q: '¿Tienen garantía?',
        a: 'Todos los armazones tienen garantía de 6 meses por defectos de fabricación (bisagras, pintura, soldaduras). El ajuste en la óptica socia es gratis siempre.',
      },
    ],
  },
];

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: GRUPOS.flatMap((g) =>
      g.items.map((i) => ({
        '@type': 'Question',
        name: i.q,
        acceptedAnswer: { '@type': 'Answer', text: i.a },
      })),
    ),
  };
  return (
    <Pagina titulo="Preguntas frecuentes" intro="Si no encontrás tu respuesta, escribinos.">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="space-y-10">
        {GRUPOS.map((g) => (
          <section key={g.titulo} aria-labelledby={`faq-${g.titulo}`}>
            <h2 id={`faq-${g.titulo}`} className="mb-2 text-2xl font-semibold">
              {g.titulo}
            </h2>
            {g.items.map((i) => (
              <Disclosure key={i.q} summary={i.q} name={`faq-${g.titulo}`}>
                <p>{i.a}</p>
              </Disclosure>
            ))}
          </section>
        ))}
      </div>
      <p className="mt-10 text-gris-texto">
        ¿Otra duda?{' '}
        <Link href="/contacto" className="underline underline-offset-4">
          Escribinos
        </Link>
        .
      </p>
    </Pagina>
  );
}
