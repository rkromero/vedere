import Link from 'next/link';
import { Container, IconArrowRight } from '@vedere/ui';
import type { Producto } from '@/lib/types';
import { Carousel } from '../Carousel';
import { LazyMount } from '../LazyMount';
import { ProductCard } from '../ProductCard';

export function MasVendidos({ productos }: { productos: Producto[] }) {
  if (productos.length === 0) return null;
  return (
    <section aria-labelledby="mas-vendidos-titulo" className="bg-gris-claro">
      <Container className="py-14 md:py-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="mas-vendidos-titulo" className="font-campaign text-4xl md:text-5xl">
            Más vendidos
          </h2>
          <Link
            href="/mas-vendidos"
            className="font-text hidden items-center gap-1 text-sm font-medium underline-offset-4 hover:underline sm:inline-flex lg:mr-28"
          >
            Ver todos <IconArrowRight size={16} />
          </Link>
        </div>
        <LazyMount minHeight="20rem">
          <Carousel label="Productos más vendidos">
            {productos.map((p) => (
              <ProductCard
                key={p.id}
                producto={p}
                sizes="(min-width: 1024px) 23vw, (min-width: 640px) 44vw, 70vw"
              />
            ))}
          </Carousel>
        </LazyMount>
        <Link
          href="/mas-vendidos"
          className="font-text mt-4 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline sm:hidden"
        >
          Ver todos <IconArrowRight size={16} />
        </Link>
      </Container>
    </section>
  );
}
