import Link from 'next/link';
import { Container } from '@vedere/ui';

const colecciones = [
  { nombre: 'Sol', color: 'bg-sol', href: '/sol' },
  { nombre: 'Vetro', color: 'bg-vetro', href: '/recetados' },
  { nombre: 'Noche', color: 'bg-noche', href: '/multifocales' },
  { nombre: 'Carey', color: 'bg-carey', href: '/accesorios' },
];

export default function HomePage() {
  return (
    <>
      <section className="bg-gris-claro">
        <Container className="py-20 md:py-28">
          <p className="font-text mb-4 text-sm font-medium uppercase tracking-widest text-gris-medio">
            Óptica online · Argentina
          </p>
          <h1 className="font-campaign text-6xl md:text-8xl lg:text-9xl">
            Mirá
            <br />
            distinto
          </h1>
          <p className="font-text mt-8 max-w-xl text-lg text-negro/80">
            Elegís tus anteojos online. Tu óptica socia más cercana arma el pedido, te lo entrega y
            lo ajusta a tu medida.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/sol"
              className="inline-flex h-12 items-center rounded-full bg-negro px-7 text-base font-medium text-blanco transition-colors hover:bg-negro/85"
            >
              Ver colección
            </Link>
            <Link
              href="/como-funciona"
              className="inline-flex h-12 items-center rounded-full border border-negro bg-transparent px-7 text-base font-medium text-negro transition-colors hover:bg-blanco"
            >
              Cómo funciona
            </Link>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16">
          <h2 className="font-text mb-8 text-2xl font-semibold">Colección</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {colecciones.map((c) => (
              <Link
                key={c.nombre}
                href={c.href}
                className={`${c.color} group flex aspect-[4/5] items-end rounded-2xl p-5 transition-transform hover:-translate-y-1`}
              >
                <span className="font-campaign text-3xl text-negro md:text-4xl">{c.nombre}</span>
              </Link>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
