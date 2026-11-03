// Prompt 6 — conversiones server-side: payload de Meta CAPI y GA4 MP con event_id `purchase-<pedidoId>`,
// hashes de email/teléfono, envío con fetch stubbeado al aprobarse el pago, y que un fallo no frene el pedido.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { eventIdCompra, hashMeta, normalizarTelefono } from '../src/lib/marketing.js';
import { crearContexto, crearPedido, aprobarPago } from './prompt6-helpers.js';
import type { Contexto } from './prompt6-helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;

describe('marketing (unitario)', () => {
  it('normaliza y hashea', () => {
    expect(eventIdCompra('abc')).toBe('purchase-abc');
    expect(hashMeta(' Ana@Test.com ')).toBe(hashMeta('ana@test.com'));
    expect(hashMeta('')).toBeNull();
    expect(normalizarTelefono('+54 11 5555-1234')).toBe('541155551234');
    expect(normalizarTelefono('011 5555 1234')).toBe('541155551234');
    expect(normalizarTelefono(null)).toBeNull();
  });
});

describe.skipIf(!hasDb)('marketing (integración)', () => {
  let ctx: Contexto;
  const llamadas: Array<{ url: string; body: Record<string, unknown> }> = [];
  let respuestaMeta = 200;

  beforeAll(async () => {
    ctx = await crearContexto({
      META_PIXEL_ID: '123456',
      META_CAPI_TOKEN: 'token-meta',
      META_TEST_EVENT_CODE: 'TEST1234',
      GA4_MEASUREMENT_ID: 'G-ABC123',
      GA4_API_SECRET: 'ga4-secret',
    });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await ctx.app.close();
  });

  function stub() {
    llamadas.length = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      llamadas.push({ url, body: JSON.parse(String(init?.body)) });
      if (url.startsWith('https://graph.facebook.com/')) {
        return new Response(JSON.stringify(respuestaMeta === 200 ? { events_received: 1 } : { error: { message: 'bad token' } }), { status: respuestaMeta, headers: { 'content-type': 'application/json' } });
      }
      if (url.startsWith('https://www.google-analytics.com/mp/collect')) return new Response('', { status: 204 });
      throw new Error(`fetch inesperado: ${url}`);
    });
  }

  it('al aprobarse el pago manda Purchase a Meta CAPI y purchase a GA4 con el mismo id de evento', async () => {
    stub();
    const pedido = await crearPedido(ctx, { items: [{ varianteId: ctx.ids.solA, cantidad: 2 }] });
    const aprobado = await aprobarPago(ctx, pedido.id);
    expect(aprobado.estadoPago).toBe('APROBADO');

    const meta = llamadas.find((l) => l.url.startsWith('https://graph.facebook.com/v21.0/123456/events?access_token=token-meta'))!;
    expect(meta).toBeTruthy();
    expect(meta.body.test_event_code).toBe('TEST1234');
    const ev = (meta.body.data as Array<Record<string, unknown>>)[0]!;
    expect(ev.event_name).toBe('Purchase');
    expect(ev.event_id).toBe(`purchase-${pedido.id}`);
    expect(ev.action_source).toBe('website');
    expect(ev.event_source_url).toBe(`http://localhost:3000/gracias/${pedido.id}`);
    const ud = ev.user_data as Record<string, string[]>;
    expect(ud.em).toEqual([hashMeta('cli@p6.vedere')]);
    expect(ud.ph).toEqual([hashMeta('541155551234')]);
    expect(ud.fn).toEqual([hashMeta('Ana')]);
    expect(ud.external_id).toEqual([hashMeta(ctx.ids.cliente)]);
    const cd = ev.custom_data as Record<string, unknown>;
    expect(cd).toMatchObject({ currency: 'ARS', value: 180000, order_id: pedido.numero, content_ids: ['P6-SOL-A-NEG'], num_items: 2 });
    expect(cd.contents).toEqual([{ id: 'P6-SOL-A-NEG', quantity: 2, item_price: 90000 }]);

    const ga4 = llamadas.find((l) => l.url.startsWith('https://www.google-analytics.com/mp/collect?measurement_id=G-ABC123&api_secret=ga4-secret'))!;
    expect(ga4).toBeTruthy();
    expect(ga4.body.client_id).toBe(ctx.ids.cliente);
    const g = (ga4.body.events as Array<Record<string, unknown>>)[0]!;
    expect(g.name).toBe('purchase');
    expect(g.params).toMatchObject({ transaction_id: pedido.numero, value: 180000, currency: 'ARS', shipping: 0 });
    expect((g.params as { items: unknown[] }).items).toEqual([{ item_id: 'P6-SOL-A-NEG', item_name: 'Sol A', item_variant: 'Negro', item_category: 'SOL', price: 90000, quantity: 2 }]);
  });

  it('un error de Meta no frena la aprobación del pago; sin credenciales no se llama a nadie', async () => {
    respuestaMeta = 400;
    stub();
    const pedido = await crearPedido(ctx, { email: 'fallo@p6.vedere', conSesion: false });
    const aprobado = await aprobarPago(ctx, pedido.id);
    expect(aprobado.estadoPago).toBe('APROBADO');
    expect(llamadas.filter((l) => l.url.startsWith('https://graph.facebook.com/'))).toHaveLength(1);
    respuestaMeta = 200;

    const { enviarConversionCompra } = await import('../src/lib/marketing.js');
    const { testEnv } = await import('./helpers.js');
    const full = await ctx.prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id }, include: { items: true, pagos: true, optica: true, receta: true, cuponUso: { include: { cupon: { select: { codigo: true, creadorId: true } } } } } });
    llamadas.length = 0;
    const r = await enviarConversionCompra(full, testEnv({ DATABASE_URL: process.env.TEST_DATABASE_URL! }));
    expect(r).toEqual({ meta: 'OMITIDO', ga4: 'OMITIDO', errores: [] });
    expect(llamadas).toHaveLength(0);
  });
});
