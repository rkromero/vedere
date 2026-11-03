import Image from 'next/image';
import Link from 'next/link';
import { Container, cn } from '@vedere/ui';
import type { Coleccion } from '@/lib/tienda/types';
import { textoSobre } from '@/lib/tienda/color';

export function Colecciones({ colecciones }: { colecciones: Coleccion[] }) {
  if (colecciones.length === 0) return null;
  return (
    <section aria-labelledby="colecciones-titulo">
      <Container className="py-14 md:py-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="colecciones-titulo" className="font-campaign text-4xl md:text-5xl">
            Colecciones
          </h2>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {colecciones.map((c) => {
            const { clase } = textoSobre(c.colorHex);
            return (
              <li key={c.id}>
                <Link
                  href={`/coleccion/${c.slug}`}
                  className={cn(
                    'group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl p-4 transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche focus-visible:ring-offset-2 md:p-5',
                    clase,
                  )}
                  style={{ backgroundColor: c.colorHex }}
                >
                  {c.portadaMedianaUrl && (
                    <Image
                      src={c.portadaMedianaUrl}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 25vw, 50vw"
                      className="object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent"
                  />
                  <span className="font-campaign relative text-3xl text-blanco drop-shadow md:text-4xl">
                    {c.nombre}
                  </span>
                  <span className="font-text relative text-sm text-blanco/90">
                    {c.productos} {c.productos === 1 ? 'modelo' : 'modelos'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
