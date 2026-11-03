import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import '@/styles/globals.css';
import { site } from '@/config/site';
import { PromoBar } from '@/components/PromoBar';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

// Archivo variable con ejes wdth (62–125) y wght (100–900).
const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
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
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={archivo.variable}>
      <body className="flex min-h-screen flex-col">
        <PromoBar />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
