// Cáscara común de la tienda: promo rotativa, header, contenido, footer, WhatsApp, carrito,
// banner de cookies y analítica (prompt 6).
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { SkipLink } from '@vedere/ui';
import { CartProvider } from '@/lib/tienda/cart';
import { ComercialProvider } from '@/lib/tienda/comercial';
import { CONFIG_FALLBACK } from '@/lib/tienda/checkout';
import type { ConfigCheckout } from '@/lib/tienda/checkout';
import { SITIO_FALLBACK } from '@/lib/tienda/sitio';
import type { SitioConfig } from '@/lib/tienda/sitio';
import { Analytics } from '@/components/marketing/Analytics';
import { CookieBanner } from '@/components/marketing/CookieBanner';
import { PromoBar } from './PromoBar';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from './cart/CartDrawer';
import { WhatsAppFab } from './WhatsAppFab';

export function TiendaChrome({
  config = CONFIG_FALLBACK,
  sitio = SITIO_FALLBACK,
  children,
}: {
  config?: ConfigCheckout;
  sitio?: SitioConfig;
  children: ReactNode;
}) {
  return (
    <ComercialProvider config={config}>
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <SkipLink />
        <PromoBar />
        <Header />
        <main id="contenido" className="flex-1" tabIndex={-1}>
          {children}
        </main>
        <Footer fiscal={sitio.fiscal} />
      </div>
      <CartDrawer />
      <WhatsAppFab />
      <CookieBanner />
      {/* useSearchParams exige Suspense para no desoptimizar el render estático. */}
      <Suspense fallback={null}>
        <Analytics />
      </Suspense>
    </CartProvider>
    </ComercialProvider>
  );
}
