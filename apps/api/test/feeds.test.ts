// Prompt 6 — feeds de productos: Google Shopping (RSS 2.0 con namespace g:) y Meta (CSV), sólo productos
// publicados, una entrada por variante activa, precio de lista + oferta, disponibilidad por stock.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { feedGoogleXml, feedMetaCsv, invalidarFeeds, itemsFeed } from '../src/lib/feeds.js';
import { crearContexto } from './prompt6-helpers.js';
import type { Contexto } from './prompt6-helpers.js';
import { testEnv } from './helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;

describe('feeds (unitario)', () => {
  const env = testEnv();
  const item = {
    id: 'SKU-1',
    title: 'Sol <A> & Co',
    description: 'Desc "rara", con coma',
    link: 'http://localhost:3000/p/sol-a?variante=v1',
    imageLink: null,
    availability: 'in stock' as const,
    price: '100000.00 ARS',
    salePrice: '90000.00 ARS',
    brand: 'Vedere',
    condition: 'new' as const,
    productType: 'Anteojos de sol',
    itemGroupId: 'p1',
    color: 'Negro',
  };
  it('XML escapa y lleva los campos g:', () => {
    const xml = feedGoogleXml(env, [item]);
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain('<title>Sol &lt;A&gt; &amp; Co</title>');
    expect(xml).toContain('<g:price>100000.00 ARS</g:price>');
    expect(xml).toContain('<g:sale_price>90000.00 ARS</g:sale_price>');
    expect(xml).toContain('<g:item_group_id>p1</g:item_group_id>');
    expect(xml).not.toContain('<g:image_link>');
  });
  it('CSV con BOM y comillas', () => {
    const csv = feedMetaCsv([item]);
    expect(csv.startsWith('﻿id,title,description,availability')).toBe(true);
    expect(csv).toContain('"Desc ""rara"", con coma"');
    expect(csv.trim().split('\n')).toHaveLength(2);
  });
});

describe.skipIf(!hasDb)('feeds (integración)', () => {
  let ctx: Contexto;
  beforeAll(async () => {
    ctx = await crearContexto();
    await ctx.prisma.producto.create({
      data: { nombre: 'Borrador', slug: 'borrador', linea: 'SOL', precio: 1, estado: 'BORRADOR', variantes: { create: [{ sku: 'P6-BORR', colorArmazon: 'Rojo', stock: 9 }] } },
    });
    invalidarFeeds();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('itemsFeed: una entrada por variante activa de productos publicados', async () => {
    const items = await itemsFeed(ctx.app.env);
    expect(items.map((i) => i.id).sort()).toEqual(['P6-REC-R', 'P6-SOL-A-CAR', 'P6-SOL-A-NEG']);
    const neg = items.find((i) => i.id === 'P6-SOL-A-NEG')!;
    expect(neg).toMatchObject({ title: 'Sol A · Negro', availability: 'in stock', price: '100000.00 ARS', salePrice: '90000.00 ARS', brand: 'Vedere Lab', color: 'Negro', itemGroupId: ctx.ids.productoSol, imageLink: 'https://media.test/sol-a.webp' });
    expect(neg.link).toBe(`http://localhost:3000/p/sol-a?variante=${ctx.ids.solA}`);
    expect(items.find((i) => i.id === 'P6-SOL-A-CAR')!.availability).toBe('out of stock');
    expect(items.find((i) => i.id === 'P6-REC-R')).toMatchObject({ price: '120000.00 ARS', salePrice: null, brand: 'Vedere', productType: 'Anteojos recetados' });
  });

  it('GET /feeds/google.xml y /feeds/meta.csv responden con el content-type correcto y cache', async () => {
    const xml = await ctx.inject('GET', '/feeds/google.xml');
    expect(xml.statusCode).toBe(200);
    expect(xml.headers['content-type']).toContain('application/rss+xml');
    expect(xml.headers['cache-control']).toContain('max-age=300');
    expect(xml.body).toContain('<g:id>P6-SOL-A-NEG</g:id>');
    expect(xml.body).not.toContain('P6-BORR');

    const csv = await ctx.inject('GET', '/feeds/meta.csv');
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body.split('\n')).toHaveLength(5); // BOM+cabecera, 3 variantes, línea final
    expect(csv.body).toContain('P6-SOL-A-CAR,Sol A · Carey');
  });
});
