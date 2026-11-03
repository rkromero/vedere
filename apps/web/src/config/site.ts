// Configuración del sitio. Lo variable viene de env (NEXT_PUBLIC_*), nunca hardcodeado.
const publicApi = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const site = {
  name: 'Vedere',
  tagline: 'Anteojos online, ajustados en tu óptica más cercana',
  description:
    'Anteojos de sol, recetados y multifocales. Comprás online y tu óptica socia más cercana arma, entrega y ajusta tu pedido.',
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  /** URL pública de la API (navegador). */
  apiUrl: publicApi,
  /** URL de la API para llamadas desde el servidor Next (proxy y server components). */
  apiServerUrl: (process.env.API_URL ?? publicApi).replace(/\/$/, ''),
  /** Barra de promo: respaldo por env cuando el admin no cargó mensajes. */
  promo: {
    enabled: (process.env.NEXT_PUBLIC_PROMO_ENABLED ?? 'true') === 'true',
    text: process.env.NEXT_PUBLIC_PROMO_TEXT ?? 'Envío gratis y ajuste en tu óptica más cercana',
    link: process.env.NEXT_PUBLIC_PROMO_LINK ?? '',
  },
  /** Condiciones comerciales visibles en toda la tienda. */
  comercial: {
    /** Cuotas sin interés que se muestran junto al precio. */
    cuotas: num(process.env.NEXT_PUBLIC_CUOTAS, 6),
    /** Monto desde el que el envío es gratis (ARS). */
    envioGratisDesde: num(process.env.NEXT_PUBLIC_ENVIO_GRATIS_DESDE, 80000),
    /** Días para cambios y devoluciones. */
    diasCambio: 30,
  },
  /** Número de WhatsApp (formato internacional sin +, ej. 5491112345678). */
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? '',
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM ?? 'https://www.instagram.com/vedere.ar',
  emailContacto: process.env.NEXT_PUBLIC_EMAIL_CONTACTO ?? 'hola@vedere.com.ar',
  /** Analítica (prompt 6): los scripts se cargan sólo con consentimiento de cookies. Vacío = apagado. */
  analytics: {
    gtmId: process.env.NEXT_PUBLIC_GTM_ID ?? '',
    ga4Id: process.env.NEXT_PUBLIC_GA4_ID ?? '',
    metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '',
    /** Modo debug de GA4 (DebugView) y log en consola de cada evento. También con ?debug_analytics=1. */
    debug: (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG ?? 'false') === 'true',
  },
  /** Banner de colaboración de la home. */
  colab: {
    titulo: process.env.NEXT_PUBLIC_COLAB_TITULO ?? 'Vedere × Taller Luz',
    texto:
      process.env.NEXT_PUBLIC_COLAB_TEXTO ??
      'Una cápsula de acetatos tallados a mano, numerados, hecha con un taller de Buenos Aires. Pocas unidades.',
    href: process.env.NEXT_PUBLIC_COLAB_LINK ?? '/coleccion/carey',
    cta: 'Ver la cápsula',
  },
  nav: [
    { label: 'Sol', href: '/sol' },
    { label: 'Recetados', href: '/recetados' },
    { label: 'Multifocales', href: '/multifocales' },
    { label: 'Accesorios', href: '/accesorios' },
    { label: 'Ópticas', href: '/opticas' },
  ],
  footer: {
    ayuda: [
      { label: 'Cómo funciona', href: '/como-funciona' },
      { label: 'Envíos y retiros', href: '/envios' },
      { label: 'Cambios y devoluciones', href: '/cambios-y-devoluciones' },
      { label: 'Preguntas frecuentes', href: '/faq' },
    ],
    empresa: [
      { label: 'Sobre Vedere', href: '/nosotros' },
      { label: 'Ópticas socias', href: '/opticas' },
      { label: 'Sumá tu óptica', href: '/opticas/sumate' },
      { label: 'Contacto', href: '/contacto' },
    ],
    legal: [
      { label: 'Términos y condiciones', href: '/legal/terminos' },
      { label: 'Privacidad', href: '/legal/privacidad' },
      { label: 'Cookies', href: '/legal/cookies' },
      { label: 'Botón de arrepentimiento', href: '/legal/arrepentimiento' },
    ],
  },
} as const;

/** Enlace de WhatsApp con mensaje prearmado (o null si no hay número configurado). */
export function whatsappLink(mensaje?: string, numero: string = site.whatsapp): string | null {
  const n = numero.replace(/\D/g, '');
  if (!n) return null;
  const text = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/${n}${text}`;
}
