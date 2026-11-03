import type { MetadataRoute } from 'next';
import { site } from '@/config/site';
import { catalogo } from '@/lib/tienda/api';
import type { Producto, Paged } from '@/lib/types';

export const revalidate = 3600;

const ESTATICAS = [
  '',
  '/sol',
  '/recetados',
  '/multifocales',
  '/accesorios',
  '/novedades',
  '/mas-vendidos',
  '/opticas',
  '/opticas/sumate',
  '/como-funciona',
  '/envios',
  '/cambios-y-devoluciones',
  '/faq',
  '/contacto',
  '/nosotros',
  '/legal/terminos',
  '/legal/privacidad',
  '/legal/cookies',
  '/legal/arrepentimiento',
  '/ingresar',
  '/pedido',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ items: colecciones }, productos] = await Promise.all([
    catalogo.colecciones(),
    catalogo.productos('?pageSize=100&orden=novedades') as Promise<Paged<Producto>>,
  ]);
  const now = new Date();
  return [
    ...ESTATICAS.map((p) => ({ url: `${site.url}${p}`, lastModified: now })),
    ...colecciones.map((c) => ({ url: `${site.url}/coleccion/${c.slug}`, lastModified: now })),
    ...productos.items.map((p) => ({
      url: `${site.url}/p/${p.slug}`,
      lastModified: new Date(p.updatedAt),
    })),
  ];
}
