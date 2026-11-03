import type { MetadataRoute } from 'next';
import { site } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/optica',
          '/api',
          '/buscar',
          '/checkout',
          '/gracias',
          '/cuenta',
          '/mi-cuenta',
          '/ingresar',
          '/recuperar',
          '/restablecer',
          '/r/',
          '/newsletter/baja',
        ],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
