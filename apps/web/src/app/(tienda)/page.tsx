import type { Metadata } from 'next';
import { site } from '@/config/site';
import { catalogo } from '@/lib/tienda/api';
import { Hero } from '@/components/tienda/home/Hero';
import { Colecciones } from '@/components/tienda/home/Colecciones';
import { MasVendidos } from '@/components/tienda/home/MasVendidos';
import { AjusteOptica } from '@/components/tienda/home/AjusteOptica';
import { Multifocal } from '@/components/tienda/home/Multifocal';
import { ColabBanner } from '@/components/tienda/home/ColabBanner';
import { Newsletter } from '@/components/tienda/home/Newsletter';

export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: `${site.name} — ${site.tagline}` },
  description: site.description,
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const [{ items: colecciones }, masVendidos] = await Promise.all([
    catalogo.colecciones(),
    catalogo.productos('?orden=mas_vendidos&pageSize=8'),
  ]);
  // Colección activa: la primera vigente con productos (la API ya ordena por vigencia).
  const activa = colecciones.find((c) => c.productos > 0) ?? colecciones[0] ?? null;

  return (
    <>
      <Hero coleccion={activa} />
      <Colecciones colecciones={colecciones} />
      <MasVendidos productos={masVendidos.items} />
      <AjusteOptica />
      <Multifocal />
      <ColabBanner />
      <Newsletter />
    </>
  );
}
