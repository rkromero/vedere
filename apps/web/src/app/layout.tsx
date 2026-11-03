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
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={archivo.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
