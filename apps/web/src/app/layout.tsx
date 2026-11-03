import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import '@/styles/globals.css';
import { site } from '@/config/site';

// Archivo variable con ejes wdth (62–125) y wght (100–900).
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description:
    'Anteojos de sol, recetados y multifocales. Comprás online y tu óptica socia más cercana arma, entrega y ajusta tu pedido.',
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    siteName: site.name,
    url: site.url,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${site.name} — ${site.tagline}` }],
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

// JSON-LD Organization + WebSite (prompt 6): identidad de marca y búsqueda interna para Google.
const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${site.url}/#organization`,
    name: site.name,
    url: site.url,
    logo: `${site.url}/brand/logo.svg`,
    email: site.emailContacto,
    sameAs: [site.instagram].filter(Boolean),
    areaServed: 'AR',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: site.emailContacto,
      availableLanguage: 'es',
      ...(site.whatsapp ? { telephone: `+${site.whatsapp}` } : {}),
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site.url}/#website`,
    name: site.name,
    url: site.url,
    inLanguage: 'es-AR',
    publisher: { '@id': `${site.url}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${site.url}/buscar?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={archivo.variable}>
      <body className="min-h-screen">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {children}
      </body>
    </html>
  );
}
