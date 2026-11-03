import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Pagina } from '@/components/tienda/Pagina';
import { Markdown } from '@/components/tienda/legal/Markdown';
import { CookiePreferencias } from '@/components/marketing/CookieBanner';
import { paginaLegal } from '@/lib/tienda/api';
import { LEGAL_META, LEGAL_SLUGS } from '@/lib/tienda/sitio';
import type { LegalSlug } from '@/lib/tienda/sitio';

export const revalidate = 60;

function esLegal(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug);
}

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!esLegal(slug)) return { title: 'Página no encontrada' };
  const pagina = await paginaLegal(slug);
  const meta = LEGAL_META[slug];
  return {
    title: pagina?.titulo ?? meta.titulo,
    description: pagina?.intro ?? meta.description,
    alternates: { canonical: `/legal/${slug}` },
  };
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Páginas legales editables desde /admin/legal (términos, privacidad, cookies). */
export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!esLegal(slug)) notFound();
  const pagina = await paginaLegal(slug);
  if (!pagina) notFound();
  return (
    <Pagina
      titulo={pagina.titulo}
      intro={pagina.intro ?? `Última actualización: ${fechaLarga(pagina.updatedAt)}.`}
    >
      {slug === 'cookies' && (
        <div className="mb-8">
          <CookiePreferencias />
        </div>
      )}
      <Markdown contenido={pagina.contenido} />
      {pagina.intro && (
        <p className="mt-10 text-sm text-gris-texto">Última actualización: {fechaLarga(pagina.updatedAt)}.</p>
      )}
    </Pagina>
  );
}
