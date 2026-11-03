import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, buttonClasses } from '@vedere/ui';
import { catalogo } from '@/lib/tienda/api';
import { OpticasExplorer } from '@/components/tienda/opticas/OpticasExplorer';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Ópticas socias',
  description:
    'Encontrá la óptica socia Vedere más cercana: ahí arman, entregan y ajustan tu pedido.',
  alternates: { canonical: '/opticas' },
};

export default async function OpticasPage() {
  const { items } = await catalogo.opticas('?limit=100');
  return (
    <>
      <section className="bg-gris-claro">
        <Container className="py-10 md:py-14">
          <h1 className="font-campaign text-5xl md:text-7xl">Ópticas socias</h1>
          <p className="font-text mt-4 max-w-2xl text-lg text-negro/75">
            Comprás en Vedere y la óptica más cercana a tu casa arma el pedido, te lo entrega y te
            lo ajusta. Gratis, todas las veces que haga falta.
          </p>
        </Container>
      </section>
      <Container className="py-8 md:py-12">
        <OpticasExplorer opticas={items} />
        <div className="font-text mt-12 rounded-3xl bg-negro p-6 text-blanco md:p-10">
          <h2 className="font-campaign text-3xl md:text-4xl">¿Tenés una óptica?</h2>
          <p className="mt-3 max-w-xl text-blanco/80">
            Sumate a la red Vedere: te derivamos clientes de tu zona y vos los atendés en tu local.
          </p>
          <Link href="/opticas/sumate" className={buttonClasses('blanco', 'md', 'mt-6')}>
            Sumá tu óptica
          </Link>
        </div>
      </Container>
    </>
  );
}
