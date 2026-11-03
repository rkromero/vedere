// Cáscara común de la tienda: promo rotativa, header, contenido, footer, WhatsApp y carrito.
import type { ReactNode } from 'react';
import { SkipLink } from '@vedere/ui';
import { CartProvider } from '@/lib/tienda/cart';
import { ComercialProvider } from '@/lib/tienda/comercial';
import { CONFIG_FALLBACK } from '@/lib/tienda/checkout';
import type { ConfigCheckout } from '@/lib/tienda/checkout';
import { PromoBar } from './PromoBar';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from './cart/CartDrawer';
import { WhatsAppFab } from './WhatsAppFab';

export function TiendaChrome({ config = CONFIG_FALLBACK, children }: { config?: ConfigCheckout; children: ReactNode }) {
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
        <Footer />
      </div>
      <CartDrawer />
      <WhatsAppFab />
    </CartProvider>
    </ComercialProvider>
  );
}
