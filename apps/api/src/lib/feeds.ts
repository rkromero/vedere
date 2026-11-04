// Feeds de productos (prompt 6): Google Shopping (RSS 2.0 + namespace g:) y Meta Catalog (CSV).
// Una entrada por variante activa de producto publicado; item_group_id agrupa las variantes del producto.
// Se cachean 5 minutos en memoria (los precios y el stock no cambian a cada segundo).
import { EN_TIENDA } from './canales.js';
import { prisma } from '@vedere/db';
import type { Env } from '../env.js';
import { dec } from './serialize.js';

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { en: number; body: string }>();

const LINEA_LABEL: Record<string, string> = {
  SOL: 'Anteojos de sol',
  RECETADO: 'Anteojos recetados',
  MULTIFOCAL: 'Anteojos multifocales',
  ACCESORIO: 'Accesorios',
};

export interface ItemFeed {
  id: string;
  title: string;
  description: string;
  link: string;
  imageLink: string | null;
  availability: 'in stock' | 'out of stock';
  price: string;
  salePrice: string | null;
  brand: string;
  condition: 'new';
  productType: string;
  itemGroupId: string;
  color: string;
}

const ars = (n: number) => `${n.toFixed(2)} ARS`;

export async function itemsFeed(env: Env): Promise<ItemFeed[]> {
  const web = env.WEB_URL.replace(/\/$/, '');
  const productos = await prisma.producto.findMany({
    where: { ...EN_TIENDA },
    include: {
      marca: { select: { nombre: true } },
      categorias: { select: { nombre: true }, take: 1 },
      variantes: { where: { activa: true }, orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }], include: { imagenes: { orderBy: { orden: 'asc' }, take: 1 } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const out: ItemFeed[] = [];
  for (const p of productos) {
    const precio = dec(p.precio) ?? 0;
    const lista = dec(p.precioLista);
    const enOferta = lista !== null && lista > precio;
    const descripcion = (p.seoDescription || p.descripcion || `${p.nombre} de Vedere. Comprás online y los ajustás gratis en tu óptica socia más cercana.`).replace(/\s+/g, ' ').trim().slice(0, 5000);
    const tipo = [LINEA_LABEL[p.linea] ?? p.linea, p.categorias[0]?.nombre].filter(Boolean).join(' > ');
    for (const v of p.variantes) {
      out.push({
        id: v.sku,
        title: `${p.nombre} · ${v.colorArmazon}`.slice(0, 150),
        description: descripcion,
        link: `${web}/p/${p.slug}?variante=${v.id}`,
        imageLink: v.imagenes[0]?.url ?? null,
        availability: v.stock > 0 ? 'in stock' : 'out of stock',
        price: ars(enOferta ? lista : precio),
        salePrice: enOferta ? ars(precio) : null,
        brand: p.marca?.nombre ?? 'Vedere',
        condition: 'new',
        productType: tipo,
        itemGroupId: p.id,
        color: v.colorArmazon,
      });
    }
  }
  return out;
}

function xml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function feedGoogleXml(env: Env, items: ItemFeed[]): string {
  const web = env.WEB_URL.replace(/\/$/, '');
  const entradas = items
    .map(
      (i) => `  <item>
    <g:id>${xml(i.id)}</g:id>
    <title>${xml(i.title)}</title>
    <description>${xml(i.description)}</description>
    <link>${xml(i.link)}</link>
    ${i.imageLink ? `<g:image_link>${xml(i.imageLink)}</g:image_link>` : ''}
    <g:availability>${i.availability}</g:availability>
    <g:price>${i.price}</g:price>
    ${i.salePrice ? `<g:sale_price>${i.salePrice}</g:sale_price>` : ''}
    <g:brand>${xml(i.brand)}</g:brand>
    <g:condition>${i.condition}</g:condition>
    <g:product_type>${xml(i.productType)}</g:product_type>
    <g:item_group_id>${xml(i.itemGroupId)}</g:item_group_id>
    <g:color>${xml(i.color)}</g:color>
    <g:google_product_category>Apparel &amp; Accessories &gt; Clothing Accessories &gt; Sunglasses</g:google_product_category>
  </item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>Vedere</title>
  <link>${xml(web)}</link>
  <description>Anteojos de sol, recetados y multifocales. Comprás online y tu óptica socia más cercana arma, entrega y ajusta tu pedido.</description>
${entradas}
</channel>
</rss>
`;
}

function csvCelda(v: string | null): string {
  const s = v ?? '';
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function feedMetaCsv(items: ItemFeed[]): string {
  const cab = ['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'brand', 'item_group_id', 'product_type', 'color'];
  const filas = items.map((i) =>
    [i.id, i.title, i.description, i.availability, i.condition, i.price, i.salePrice, i.link, i.imageLink, i.brand, i.itemGroupId, i.productType, i.color]
      .map(csvCelda)
      .join(','),
  );
  return `\uFEFF${cab.join(',')}\n${filas.join('\n')}\n`;
}

/** Cuerpo cacheado del feed pedido. */
export async function feedCacheado(env: Env, tipo: 'google' | 'meta', ahora = Date.now()): Promise<string> {
  const hit = cache.get(tipo);
  if (hit && ahora - hit.en < CACHE_MS) return hit.body;
  const items = await itemsFeed(env);
  const body = tipo === 'google' ? feedGoogleXml(env, items) : feedMetaCsv(items);
  cache.set(tipo, { en: ahora, body });
  return body;
}

export function invalidarFeeds() {
  cache.clear();
}
