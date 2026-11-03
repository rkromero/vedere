// Configuración del sitio. Lo variable viene de env (NEXT_PUBLIC_*), nunca hardcodeado.
export const site = {
  name: 'Vedere',
  tagline: 'Anteojos online, ajustados en tu óptica más cercana',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, ''),
  promo: {
    enabled: (process.env.NEXT_PUBLIC_PROMO_ENABLED ?? 'true') === 'true',
    text: process.env.NEXT_PUBLIC_PROMO_TEXT ?? 'Envío gratis y ajuste en tu óptica más cercana',
    link: process.env.NEXT_PUBLIC_PROMO_LINK ?? '',
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
      { label: 'Cambios y garantía', href: '/garantia' },
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
      { label: 'Botón de arrepentimiento', href: '/legal/arrepentimiento' },
    ],
  },
} as const;
