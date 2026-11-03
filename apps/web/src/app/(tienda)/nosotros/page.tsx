import type { Metadata } from 'next';
import { Pagina, Prose } from '@/components/tienda/Pagina';

export const metadata: Metadata = {
  title: 'Sobre Vedere',
  description: 'Una marca argentina de anteojos que une la compra online con la óptica de barrio.',
  alternates: { canonical: '/nosotros' },
};

export default function NosotrosPage() {
  return (
    <Pagina titulo="Mirá distinto" intro="Vedere nació para que comprar anteojos sea tan simple como elegirlos.">
      <Prose>
        <p>
          Comprar anteojos online tenía un problema: nadie te los ajusta, nadie te mide la receta,
          nadie te mira a la cara. Y comprarlos en la óptica tenía otro: poca variedad y precios
          que no se entienden.
        </p>
        <p>
          Vedere junta las dos cosas. Diseñamos nuestras colecciones en Buenos Aires, las vendemos
          online con precio final y cuotas, y trabajamos con una red de ópticas socias
          independientes que arman, entregan y ajustan cada pedido en tu barrio.
        </p>
        <h2>Lo que creemos</h2>
        <ul>
          <li>El producto es el protagonista: fotos grandes, poco texto, cero letra chica.</li>
          <li>Un buen par de anteojos se ajusta tantas veces como haga falta. Gratis.</li>
          <li>Las ópticas de barrio son parte de la solución, no la competencia.</li>
        </ul>
        <h2>Colecciones</h2>
        <p>
          Sol, Vetro, Noche y Carey: cuatro familias de color que se renuevan cada temporada, más
          cápsulas en colaboración con talleres y artistas locales.
        </p>
      </Prose>
    </Pagina>
  );
}
