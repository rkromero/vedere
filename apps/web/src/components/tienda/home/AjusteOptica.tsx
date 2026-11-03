import Link from 'next/link';
import { Container, IconArrowRight } from '@vedere/ui';
import { OpticaFinder } from '../opticas/OpticaFinder';

const PASOS = [
  { n: '1', t: 'Elegís online', d: 'Modelo, color y, si querés, tu receta.' },
  { n: '2', t: 'Lo arma tu óptica', d: 'La socia más cercana a tu casa prepara el pedido.' },
  { n: '3', t: 'Te lo ajustan', d: 'Pasás a buscarlo o te lo envían. Ajuste gratis a la vuelta.' },
];

export function AjusteOptica() {
  return (
    <section aria-labelledby="ajuste-titulo">
      <Container className="grid gap-10 py-14 md:grid-cols-2 md:gap-16 md:py-20">
        <div className="font-text">
          <h2 id="ajuste-titulo" className="font-campaign text-4xl md:text-6xl">
            Comprás online.
            <br />
            Te los ajustan
            <br />a la vuelta.
          </h2>
          <ol className="mt-8 space-y-5">
            {PASOS.map((p) => (
              <li key={p.n} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="font-campaign flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-negro text-xl text-blanco"
                >
                  {p.n}
                </span>
                <div>
                  <p className="text-lg font-semibold">{p.t}</p>
                  <p className="text-gris-texto">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href="/como-funciona"
            className="mt-6 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            Cómo funciona <IconArrowRight size={16} />
          </Link>
        </div>
        <div className="rounded-3xl bg-gris-claro p-5 sm:p-8">
          <h3 className="font-text text-xl font-semibold">Buscá tu óptica socia</h3>
          <p className="font-text mt-1 text-gris-texto">
            Ingresá tu código postal y te mostramos las más cercanas.
          </p>
          <div className="mt-5">
            <OpticaFinder compacto />
          </div>
        </div>
      </Container>
    </section>
  );
}
