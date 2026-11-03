// Prompt 6 — reportes del backoffice: totales, ticket promedio, conversión, por día/estado/línea/óptica/
// colección/creador, más vendidos, filtro por fechas y CSV.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fechaAR, limitesPeriodo, periodoDefault } from '../src/lib/reportes.js';
import { crearContexto, crearPedido, crearPedidoPagado } from './prompt6-helpers.js';
import type { Contexto } from './prompt6-helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;

describe('reportes (unitario)', () => {
  it('fechas en horario de Buenos Aires', () => {
    expect(fechaAR(new Date('2026-03-10T02:30:00Z'))).toBe('2026-03-09');
    expect(fechaAR(new Date('2026-03-10T03:30:00Z'))).toBe('2026-03-10');
    const { desdeTs, hastaTs } = limitesPeriodo({ desde: '2026-03-01', hasta: '2026-03-02' });
    expect(desdeTs.toISOString()).toBe('2026-03-01T03:00:00.000Z');
    expect(hastaTs.toISOString()).toBe('2026-03-03T02:59:59.999Z');
    const def = periodoDefault(new Date('2026-03-31T15:00:00Z'));
    expect(def).toEqual({ desde: '2026-03-02', hasta: '2026-03-31' });
  });
});

describe.skipIf(!hasDb)('reportes (integración)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await crearContexto();
    const creador = await ctx.prisma.creador.create({ data: { nombre: 'Juli Creadora', slug: 'juli', activo: true } });
    await ctx.prisma.cupon.create({ data: { codigo: 'JULI10', tipo: 'PORCENTAJE', valor: 10, creadorId: creador.id, acumulable: true } });

    // 2 pedidos pagados hoy (uno con cupón de creadora y envío a domicilio), 1 pendiente, 1 pagado hace 40 días.
    await crearPedidoPagado(ctx, { items: [{ varianteId: ctx.ids.solA, cantidad: 2 }] });
    await crearPedidoPagado(ctx, { items: [{ varianteId: ctx.ids.recetado, cantidad: 1 }], cupon: 'JULI10', modalidad: 'ENVIO_DOMICILIO', email: 'otra@p6.vedere', conSesion: false });
    await crearPedido(ctx, { email: 'pendiente@p6.vedere', conSesion: false });
    const viejo = await crearPedidoPagado(ctx, { email: 'viejo@p6.vedere', conSesion: false });
    const hace40 = new Date(Date.now() - 40 * 86400_000);
    await ctx.prisma.pedido.update({ where: { id: viejo.id }, data: { pagadoEn: hace40, createdAt: hace40 } });
    await ctx.prisma.carrito.create({ data: { userId: ctx.ids.cliente, items: [{ nombre: 'Sol A' }] } });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await ctx.app.close();
  });

  it('reporte por defecto (últimos 30 días)', async () => {
    const res = await ctx.inject('GET', '/admin/reportes', ctx.staffCookie);
    expect(res.statusCode, res.body).toBe(200);
    const r = res.json();
    // Pagados hoy: 2×90.000 = 180.000 y 120.000 − 10 % (12.000) + envío 9.900 = 117.900.
    expect(r.totales.pedidos).toBe(2);
    expect(r.totales.ventas).toBe(297900);
    expect(r.totales.ticketPromedio).toBe(148950);
    // Conversión: 2 pagados ÷ (1 carrito + 3 pedidos creados en el período).
    expect(r.totales.conversion).toEqual({ pedidosPagados: 2, carritos: 4, pct: 50 });
    expect(r.hoy).toEqual({ ventas: 297900, pedidos: 2 });
    expect(r.semana.pedidos).toBe(2);
    expect(r.mes.pedidos).toBeGreaterThanOrEqual(2);
    expect(r.porDia).toHaveLength(30); // serie completa del período, días sin ventas en 0
    expect(r.porDia.filter((d: { pedidos: number }) => d.pedidos > 0)).toHaveLength(1);
    expect(r.porDia.at(-1)).toMatchObject({ fecha: fechaAR(new Date()), ventas: 297900, pedidos: 2 });

    const estados = Object.fromEntries(r.porEstado.map((e: { estado: string; cantidad: number }) => [e.estado, e.cantidad]));
    expect(estados.PENDIENTE_PAGO).toBe(1);
    expect(estados.ASIGNADO).toBe(2);

    const lineas = Object.fromEntries(r.porLinea.map((l: { clave: string; unidades: number; ventas: number }) => [l.clave, l]));
    expect(lineas.SOL.unidades).toBe(2);
    expect(lineas.SOL.ventas).toBe(180000);
    expect(lineas.RECETADO.unidades).toBe(1);
    expect(lineas.RECETADO.ventas).toBe(108000);

    expect(r.porOptica).toEqual([{ clave: ctx.ids.optica, nombre: 'Óptica Centro', pedidos: 2, unidades: 3, ventas: 297900 }]);
    expect(r.porColeccion[0]).toMatchObject({ nombre: 'Verano', pedidos: 2, unidades: 3 });
    expect(r.porCreador).toEqual([{ clave: 'JULI10', nombre: 'Juli Creadora', pedidos: 1, unidades: 1, ventas: 117900 }]);
    expect(r.masVendidos[0]).toMatchObject({ productoId: ctx.ids.productoSol, nombre: 'Sol A', slug: 'sol-a', unidades: 2, ventas: 180000 });
    expect(r.masVendidos).toHaveLength(2);
  });

  it('filtro por fechas incluye el pedido viejo y valida el rango', async () => {
    const desde = fechaAR(new Date(Date.now() - 45 * 86400_000));
    const hasta = fechaAR(new Date());
    const res = await ctx.inject('GET', `/admin/reportes?desde=${desde}&hasta=${hasta}`, ctx.staffCookie);
    expect(res.json().totales.pedidos).toBe(3);
    expect(res.json().porDia.filter((d: { pedidos: number }) => d.pedidos > 0)).toHaveLength(2);
    const soloViejo = await ctx.inject('GET', `/admin/reportes?desde=${desde}&hasta=${fechaAR(new Date(Date.now() - 35 * 86400_000))}`, ctx.staffCookie);
    expect(soloViejo.json().totales).toMatchObject({ pedidos: 1, ventas: 90000, ticketPromedio: 90000 });
    expect((await ctx.inject('GET', '/admin/reportes?desde=2026-02-01&hasta=2026-01-01', ctx.staffCookie)).statusCode).toBe(400);
    expect((await ctx.inject('GET', '/admin/reportes?desde=ayer', ctx.staffCookie)).statusCode).toBe(400);
    expect((await ctx.inject('GET', '/admin/reportes', ctx.clienteCookie)).statusCode).toBe(403);
  });

  it('CSV de pedidos e ítems', async () => {
    const pedidos = await ctx.inject('GET', '/admin/reportes/csv?tipo=pedidos', ctx.staffCookie);
    expect(pedidos.statusCode).toBe(200);
    expect(pedidos.headers['content-type']).toContain('text/csv');
    expect(pedidos.headers['content-disposition']).toContain('vedere-pedidos-');
    expect(pedidos.body.startsWith('﻿numero,creado,pagado,estado')).toBe(true);
    const filas = pedidos.body.trim().split('\n');
    expect(filas).toHaveLength(4); // cabecera + 3 pedidos del período (el viejo queda afuera)
    expect(pedidos.body).toContain('JULI10');
    expect(pedidos.body).toContain('"Ana Pérez"'.replace(/"/g, '') );

    const items = await ctx.inject('GET', '/admin/reportes/csv?tipo=items', ctx.staffCookie);
    expect(items.body.split('\n')[0]).toContain('pedido,creado,estado,estado_pago,sku,producto');
    expect(items.body).toContain('P6-SOL-A-NEG');
    expect(items.body).toContain('P6-REC-R');
    expect((await ctx.inject('GET', '/admin/reportes/csv?tipo=otro', ctx.staffCookie)).statusCode).toBe(400);
  });
});
