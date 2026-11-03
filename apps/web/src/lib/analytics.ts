// Eventos de e-commerce (prompt 6): un solo punto de entrada para GA4 (gtag / dataLayer de GTM) y Meta Pixel (fbq).
// Los scripts se cargan en components/marketing/Analytics.tsx sólo con consentimiento de cookies; si no están,
// `track` no hace nada. Nombres de eventos según GA4 (view_item, add_to_cart, begin_checkout, purchase).
export interface ItemAnalytics {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
}

export interface EventoEcommerce {
  currency: 'ARS';
  value: number;
  items: ItemAnalytics[];
  transaction_id?: string;
  coupon?: string;
  shipping?: number;
}

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    fbq?: Fbq;
  }
}

const META_EVENTO: Record<string, string> = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
  sign_up: 'CompleteRegistration',
};

/** Dispara un evento a GA4/GTM y a Meta Pixel (si están cargados). `eventId` permite deduplicar con la Conversions API. */
export function track(evento: 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase' | 'sign_up', datos: Partial<EventoEcommerce> = {}, eventId?: string) {
  if (typeof window === 'undefined') return;
  const payload = { currency: 'ARS' as const, value: 0, items: [], ...datos };
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event: evento, ecommerce: payload, event_id: eventId });
  window.gtag?.('event', evento, payload);
  const meta = META_EVENTO[evento];
  if (meta && window.fbq) {
    window.fbq(
      'track',
      meta,
      {
        value: payload.value,
        currency: 'ARS',
        content_type: 'product',
        content_ids: payload.items.map((i) => i.item_id),
        contents: payload.items.map((i) => ({ id: i.item_id, quantity: i.quantity, item_price: i.price })),
        num_items: payload.items.reduce((a, i) => a + i.quantity, 0),
      },
      eventId ? { eventID: eventId } : undefined,
    );
  }
}
