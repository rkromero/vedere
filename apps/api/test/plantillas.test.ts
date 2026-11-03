// Prompt 6 — plantillas de email editables: listado (defaults + personalizadas), edición, vista previa, prueba,
// restablecer, y que los emails reales (estado del pedido, confirmación, pago rechazado) usen la plantilla editada
// y lleven el pie fiscal.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PLANTILLAS_EMAIL_DEFAULT } from '@vedere/db';
import { cuerpoAHtml, interpolar } from '../src/lib/plantillas.js';
import { crearContexto, crearPedido, crearPedidoPagado, emailsDe } from './prompt6-helpers.js';
import type { Contexto } from './prompt6-helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;

describe('plantillas (unitario)', () => {
  it('interpola variables y convierte el cuerpo a HTML seguro', () => {
    expect(interpolar('Hola {{nombre}}, pedido {{ numero }} {{nada}}', { nombre: 'Ana', numero: 'VD-1' })).toBe('Hola Ana, pedido VD-1 ');
    const html = cuerpoAHtml('Hola **Ana** <b>x</b>\nsegunda línea\n\n- uno\n- dos');
    expect(html).toContain('<p style="margin:0 0 12px">Hola <strong>Ana</strong> &lt;b&gt;x&lt;/b&gt;<br>segunda línea</p>');
    expect(html).toContain('<ul');
    expect(html).toContain('<li>uno</li><li>dos</li>');
  });
});

describe.skipIf(!hasDb)('plantillas (integración)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await crearContexto();
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await ctx.app.close();
  });

  it('lista todas las plantillas con sus defaults', async () => {
    const res = await ctx.inject('GET', '/admin/plantillas-email', ctx.staffCookie);
    expect(res.statusCode).toBe(200);
    const items = res.json().items as Array<{ tipo: string; personalizada: boolean; variables: string[]; activa: boolean }>;
    expect(items).toHaveLength(PLANTILLAS_EMAIL_DEFAULT.length);
    const estado = items.find((i) => i.tipo === 'ESTADO_ENVIADO')!;
    expect(estado.personalizada).toBe(false);
    expect(estado.variables).toContain('seguimiento');
    expect((await ctx.inject('GET', '/admin/plantillas-email/NO_EXISTE', ctx.staffCookie)).statusCode).toBe(404);
    expect((await ctx.inject('GET', '/admin/plantillas-email', ctx.clienteCookie)).statusCode).toBe(403);
  });

  it('edita una plantilla, la vista previa usa el borrador y restablecer vuelve al default', async () => {
    const edit = await ctx.inject('PUT', '/admin/plantillas-email/estado_pagado', ctx.staffCookie, {
      asunto: 'Gracias {{nombre}}, ya tenemos tu pago del pedido {{numero}}',
      titulo: 'Pago OK',
      cuerpo: 'Hola {{nombre}}, cobramos {{total}}.\n\nTu óptica: **{{optica}}**.',
      ctaLabel: 'Seguir mi pedido',
    });
    expect(edit.statusCode, edit.body).toBe(200);
    expect(edit.json().personalizada).toBe(true);
    expect(edit.json().updatedAt).not.toBeNull();

    const preview = await ctx.inject('POST', '/admin/plantillas-email/ESTADO_PAGADO/vista-previa', ctx.staffCookie, { cuerpo: 'Borrador con {{total}}' });
    expect(preview.statusCode, preview.body).toBe(200);
    expect(preview.json().asunto).toBe('Gracias Ana, ya tenemos tu pago del pedido VD-10001');
    expect(preview.json().html).toContain('Borrador con $189.000');
    expect(preview.json().html).toContain('Seguir mi pedido');
    expect(preview.json().html).toContain('Vedere S.A.S.');
    expect(preview.json().html).toContain('CUIT 30-00000000-0');
    expect(preview.json().html).toContain('<li>1× Sol A · Negro</li>');

    const invalida = await ctx.inject('PUT', '/admin/plantillas-email/ESTADO_PAGADO', ctx.staffCookie, { asunto: 'x', titulo: 'y', cuerpo: 'z' });
    expect(invalida.statusCode).toBe(400);

    const prueba = await ctx.inject('POST', '/admin/plantillas-email/ESTADO_PAGADO/prueba', ctx.staffCookie, { para: 'yo@p6.vedere' });
    expect(prueba.statusCode, prueba.body).toBe(200);
    expect(prueba.json().estado).toBe('SIMULADO');
    const pruebas = await emailsDe(ctx.prisma, { tipo: 'PRUEBA_ESTADO_PAGADO' });
    expect(pruebas).toHaveLength(1);
    expect(pruebas[0]!.asunto).toBe('[Prueba] Gracias Ana, ya tenemos tu pago del pedido VD-10001');

    const reset = await ctx.inject('POST', '/admin/plantillas-email/ESTADO_PAGADO/restablecer', ctx.staffCookie);
    expect(reset.statusCode).toBe(200);
    expect(reset.json().personalizada).toBe(false);
    expect(reset.json().asunto).toBe(PLANTILLAS_EMAIL_DEFAULT.find((p) => p.tipo === 'ESTADO_PAGADO')!.asunto);
  });

  it('los emails del pedido usan la plantilla editada (y el default si no se editó), con pie fiscal e ítems', async () => {
    await ctx.inject('PUT', '/admin/plantillas-email/ESTADO_PAGADO', ctx.staffCookie, {
      asunto: 'PERSONALIZADO {{numero}}',
      titulo: 'Pago OK',
      cuerpo: 'Hola {{nombre}}, cobramos {{total}}.',
      ctaLabel: 'Ver',
    });
    const resendLlamadas: Array<{ to: string[]; subject: string; html: string }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === 'https://api.resend.com/emails') {
        resendLlamadas.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ id: `re_${resendLlamadas.length}` }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error(`fetch inesperado: ${url}`);
    });
    // App con RESEND_API_KEY para ver el HTML que sale.
    const { buildApp } = await import('../src/app.js');
    const { testEnv } = await import('./helpers.js');
    const app2 = await buildApp({ env: testEnv({ DATABASE_URL: process.env.TEST_DATABASE_URL!, STORAGE_DRIVER: 'local', RESEND_API_KEY: 're_test' }), logger: false });
    await app2.ready();
    try {
      const ctx2 = { ...ctx, app: app2, inject: ((m, u, c, p, h) => app2.inject({ method: m, url: u, ...(c ? { cookies: c } : {}), ...(p !== undefined ? { payload: p } : {}), ...(h ? { headers: h } : {}) })) as Contexto['inject'] };
      const pedido = await crearPedidoPagado(ctx2);

      const confirmacion = resendLlamadas.find((c) => c.subject.startsWith('Recibimos tu pedido'))!;
      expect(confirmacion).toBeTruthy();
      expect(confirmacion.to).toEqual(['cli@p6.vedere']);
      expect(confirmacion.html).toContain('CBU: <strong>0170001540000001234567</strong>');
      expect(confirmacion.html).toContain('Vedere S.A.S.');
      expect(confirmacion.html).toContain('1× Sol A');

      const pagado = resendLlamadas.find((c) => c.subject === `PERSONALIZADO ${pedido.numero}`)!;
      expect(pagado).toBeTruthy();
      expect(pagado.html).toContain('Hola Ana, cobramos $90.000.');
      expect(pagado.html).toContain('Av. Siempreviva 742');

      const asignado = resendLlamadas.find((c) => c.subject === `Tu pedido ${pedido.numero} ya tiene óptica asignada`)!;
      expect(asignado).toBeTruthy();
      expect(asignado.html).toContain('Óptica Centro');
      expect(asignado.html).toContain('Av. Rivadavia 4900, Caballito');

      const registros = await emailsDe(ctx.prisma, { pedidoId: pedido.id });
      expect(registros.map((r) => r.tipo)).toEqual(expect.arrayContaining(['PEDIDO_CONFIRMADO', 'ESTADO_PAGADO', 'ESTADO_ASIGNADO']));
      expect(registros.every((r) => r.estado === 'ENVIADO' && r.proveedor === 'resend')).toBe(true);
    } finally {
      await app2.close();
      await ctx.inject('POST', '/admin/plantillas-email/ESTADO_PAGADO/restablecer', ctx.staffCookie);
    }
  });

  it('plantilla desactivada: no se manda el email de ese tipo', async () => {
    await ctx.inject('PUT', '/admin/plantillas-email/PEDIDO_CONFIRMADO', ctx.staffCookie, { asunto: 'Apagado', titulo: 'Apagado', cuerpo: 'No sale nunca.', activa: false });
    const pedido = await crearPedido(ctx, { email: 'apagado@p6.vedere', conSesion: false });
    expect(await emailsDe(ctx.prisma, { pedidoId: pedido.id, tipo: 'PEDIDO_CONFIRMADO' })).toHaveLength(0);
    await ctx.inject('POST', '/admin/plantillas-email/PEDIDO_CONFIRMADO/restablecer', ctx.staffCookie);
  });

  it('pago rechazado por Mercado Pago manda PAGO_RECHAZADO una sola vez', async () => {
    const { rechazarPago } = await import('../src/lib/pedidos.js');
    const pedido = await crearPedido(ctx, { email: 'rechazo@p6.vedere', conSesion: false });
    const info = { proveedor: 'mercadopago' as const, externoId: '777', metodo: 'TRANSFERENCIA' as const, monto: 90000 };
    await rechazarPago(pedido.id, info, { env: ctx.app.env });
    await rechazarPago(pedido.id, { ...info, externoId: '778' }, { env: ctx.app.env });
    const emails = await emailsDe(ctx.prisma, { pedidoId: pedido.id, tipo: 'PAGO_RECHAZADO' });
    expect(emails).toHaveLength(1);
    expect(emails[0]!.asunto).toBe(`No pudimos procesar tu pago · Pedido ${pedido.numero}`);
  });
});
