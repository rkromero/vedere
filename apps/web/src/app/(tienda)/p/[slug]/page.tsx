import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Container } from '@vedere/ui';
import { site } from '@/config/site';
import { LABELS } from '@/lib/format';
import { PublicApiError, catalogo } from '@/lib/tienda/api';
import { Carousel } from '@/components/tienda/Carousel';
import { LazyMount } from '@/components/tienda/LazyMount';
import { ProductCard } from '@/components/tienda/ProductCard';
import { ProductoDetalle } from '@/components/tienda/producto/ProductoDetalle';
import { RecienVistos } from '@/components/tienda/producto/RecienVistos';

async function getProducto(slug: string) {
  try {
    return await catalogo.producto(slug);
  } catch (err) {
    if (err instanceof PublicApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProducto(slug);
  if (!p) return { title: 'Producto no encontrado' };
  const imagen = p.variantes[0]?.imagenes[0]?.url ?? p.imagenPrincipal ?? undefined;
  const title = p.seo.title ?? `${p.nombre} · ${LABELS.linea[p.linea]}`;
  const description =
    p.seo.description ??
    `${p.nombre}: ${LABELS.linea[p.linea].toLowerCase()} en ${p.variantes.length} ${
      p.variantes.length === 1 ? 'color' : 'colores'
    }. Comprás online y te los ajustan en tu óptica socia más cercana.`;
  return {
    title: { absolute: `${title} | ${site.name}` },
    description,
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: {
      type: 'website',
      title,
      description,
      images: imagen ? [{ url: imagen, width: 1600, height: 1600, alt: p.nombre }] : undefined,
    },
  };
}

export default async function ProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const [{ slug }, { v }] = await Promise.all([params, searchParams]);
  const producto = await getProducto(slug);
  if (!producto) notFound();
  const [{ items: relacionados }, accesorios] = await Promise.all([
    catalogo.relacionados(slug),
    producto.linea === 'ACCESORIO'
      ? Promise.resolve({ items: [] as typeof producto[] })
      : catalogo.productos('?linea=ACCESORIO&pageSize=8&page=1&orden=relevancia'),
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: producto.nombre,
    description: producto.descripcion || undefined,
    sku: producto.variantes[0]?.sku,
    brand: producto.marca ? { '@type': 'Brand', name: producto.marca.nombre } : undefined,
    image: producto.variantes.flatMap((v) => v.imagenes.map((i) => i.url)).slice(0, 6),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'ARS',
      lowPrice: producto.precio,
      highPrice: producto.precio,
      offerCount: producto.variantes.length,
      availability:
        producto.stockTotal > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${site.url}/p/${producto.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="px-0 pb-4 md:px-6 md:py-6">
        <ProductoDetalle producto={producto} varianteInicialId={v ?? null} />
      </div>

      {relacionados.length > 0 && (
        <section aria-labelledby="relacionados-titulo" className="border-t border-negro/10">
          <Container className="py-12">
            <h2
              id="relacionados-titulo"
              className="font-text mb-6 text-sm font-bold uppercase tracking-[0.12em] md:text-base"
            >
              Te recomendamos
            </h2>
            <LazyMount minHeight="20rem">
              <Carousel label="Productos recomendados">
                {relacionados.map((p) => (
                  <ProductCard key={p.id} producto={p} sizes="(min-width: 1024px) 23vw, 70vw" />
                ))}
              </Carousel>
            </LazyMount>
          </Container>
        </section>
      )}

      {accesorios.items.length > 0 && (
        <section aria-labelledby="accesorios-titulo" className="border-t border-negro/10">
          <Container className="py-12">
            <h2
              id="accesorios-titulo"
              className="font-text mb-6 text-sm font-bold uppercase tracking-[0.12em] md:text-base"
            >
              Accesorios
            </h2>
            <LazyMount minHeight="20rem">
              <Carousel label="Accesorios">
                {accesorios.items.map((p) => (
                  <ProductCard key={p.id} producto={p} sizes="(min-width: 1024px) 23vw, 70vw" />
                ))}
              </Carousel>
            </LazyMount>
          </Container>
        </section>
      )}

      <RecienVistos excluirSlug={producto.slug} />
    </>
  );
}
