// Héroe a pantalla completa con el color de la colección activa y su imagen (LCP).
import Image from 'next/image';
import Link from 'next/link';
import { Container, buttonClasses, cn } from '@vedere/ui';
import type { Coleccion } from '@/lib/tienda/types';
import { textoSobre } from '@/lib/tienda/color';

const TITULOS: Record<string, [string, string]> = {
  sol: ['Mirá', 'el sol'],
  vetro: ['Mirá', 'distinto'],
  noche: ['Mirá', 'de noche'],
  carey: ['Mirá', 'clásico'],
};

export function Hero({ coleccion }: { coleccion: Coleccion | null }) {
  const color = coleccion?.colorHex ?? '#F2F2F0';
  const { clase, oscuro } = textoSobre(color);
  const [l1, l2] = TITULOS[coleccion?.slug ?? ''] ?? ['Mirá', 'distinto'];
  const imagen = coleccion?.portadaUrl ?? null;

  return (
    <section
      className={cn('relative isolate overflow-hidden', clase)}
      style={{ backgroundColor: color }}
      aria-labelledby="hero-titulo"
    >
      <Container className="relative grid min-h-[calc(100svh-6.25rem)] grid-cols-1 items-end gap-8 py-10 md:grid-cols-2 md:items-center md:py-16">
        {imagen && (
          <div className="relative order-first aspect-square w-full overflow-hidden rounded-3xl md:order-last">
            <Image
              src={imagen}
              alt={coleccion ? `Colección ${coleccion.nombre}` : 'Anteojos Vedere'}
              fill
              priority
              fetchPriority="high"
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        )}
        <div className="font-text">
          <p
            className={cn(
              'mb-4 text-sm font-medium uppercase tracking-widest',
              oscuro ? 'text-negro' : 'text-blanco',
            )}
          >
            {coleccion ? `Colección ${coleccion.nombre}` : 'Óptica online · Argentina'}
          </p>
          <h1 id="hero-titulo" className="font-campaign text-[22vw] leading-[0.9] sm:text-8xl lg:text-9xl">
            {l1}
            <br />
            {l2}
          </h1>
          <p
            className={cn(
              'mt-6 max-w-md text-lg',
              oscuro ? 'text-negro' : 'text-blanco',
            )}
          >
            Elegís tus anteojos online. Tu óptica socia más cercana los arma, te los entrega y te
            los ajusta.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={coleccion ? `/coleccion/${coleccion.slug}` : '/sol'}
              className={buttonClasses(oscuro ? 'primary' : 'blanco', 'lg')}
            >
              Ver colección
            </Link>
            <Link
              href="/recetados"
              className={buttonClasses(oscuro ? 'secondary' : 'outline-blanco', 'lg')}
            >
              Recetados
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
