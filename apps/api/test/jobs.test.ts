// Prompt 6 — jobs: carrito abandonado (1 h / 24 h, idempotente, apagable), Plan Rivedere (cupón + email una vez
// por compra), "volvió el stock", y el disparo manual POST /jobs/:nombre protegido con x-cron-secret.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { jobCarritoAbandonado, resumenItems } from '../src/jobs/carrito-abandonado.js';
import { jobRivedere } from '../src/jobs/rivedere.js';
import { jobVolvioStock } from '../src/jobs/volvio-stock.js';
import { crearContexto, crearPedidoPagado, emailsDe } from './prompt6-helpers.js';
import type { Contexto } from './prompt6-helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;
const HORA = 3600_000;
const CRON = 'secreto-cron-de-prueba';

describe('jobs (unitario)', () => {
  it('resume los ítems del carrito en texto', () => {
    expect(resumenItems([{ nombre: 'Sol A', color: 'Negro', cantidad: 2 }, { nombre: 'Recetado R' }, null])).toBe('2× Sol A Negro, 1× Recetado R');
    expect(resumenItems('x')).toBe('');
  });
});

describe.skipIf(!hasDb)('jobs (integración)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await crearContexto({ CRON_SECRET: CRON });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await ctx.app.close();
  });

  async function carritoDe(userId: string, haceMs: number, items: unknown = [{ nombre: 'Sol A', color: 'Negro', cantidad: 1 }]) {
    const c = await ctx.prisma.carrito.upsert({
      where: { userId },
      update: { items: items as object, aviso1hEn: null, aviso24hEn: null },
      create: { userId, items: items as object },
    });
    // updatedAt lo maneja Prisma: lo retrocedemos a mano.
    await ctx.prisma.$executeRaw`UPDATE carritos SET updated_at = ${new Date(Date.now() - haceMs)} WHERE id = ${c.id}`;
    return c.id;
  }

  it('carrito abandonado: avisa a la hora y a las 24 h, una sola vez, y no al que ya compró', async () => {
    const ahora = new Date();
    const otro = await ctx.prisma.user.create({ data: { email: 'otro@p6.vedere', nombre: 'Otro Cliente', rol: 'CLIENTE', passwordHash: 'x' } });
    const vacio = await ctx.prisma.user.create({ data: { email: 'vacio@p6.vedere', nombre: 'Sin Items', rol: 'CLIENTE', passwordHash: 'x' } });
    const staffU = await ctx.prisma.user.create({ data: { email: 'staff-carrito@p6.vedere', nombre: 'Staff', rol: 'OPERADOR', passwordHash: 'x' } });

    await carritoDe(ctx.ids.cliente, 2 * HORA); // → aviso 1 h
    await carritoDe(otro.id, 30 * HORA); // → aviso 24 h (y marca el de 1 h)
    await carritoDe(vacio.id, 5 * HORA, []); // sin ítems: no se escribe
    await carritoDe(staffU.id, 5 * HORA); // staff: no

    expect(await jobCarritoAbandonado(ctx.app.env, ahora)).toBe(2);
    const e1 = await emailsDe(ctx.prisma, { tipo: 'CARRITO_ABANDONADO_1H' });
    expect(e1.map((e) => e.para)).toEqual(['cli@p6.vedere']);
    expect(e1[0]!.asunto).toBe('¿Te ayudamos a terminar tu compra?');
    const e24 = await emailsDe(ctx.prisma, { tipo: 'CARRITO_ABANDONADO_24H' });
    expect(e24.map((e) => e.para)).toEqual(['otro@p6.vedere']);
    expect(e24[0]!.asunto).toBe('Todavía están disponibles: 1× Sol A Negro');

    // Idempotente.
    expect(await jobCarritoAbandonado(ctx.app.env, ahora)).toBe(0);

    // El carrito del primer cliente pasa las 24 h → aviso de 24 h.
    await ctx.prisma.$executeRaw`UPDATE carritos SET updated_at = ${new Date(ahora.getTime() - 25 * HORA)} WHERE user_id = ${ctx.ids.cliente}`;
    expect(await jobCarritoAbandonado(ctx.app.env, ahora)).toBe(1);
    expect(await emailsDe(ctx.prisma, { tipo: 'CARRITO_ABANDONADO_24H' })).toHaveLength(2);

    // Quien compró después de tocar el carrito no recibe nada.
    const comprador = await ctx.prisma.user.create({ data: { email: 'compro@p6.vedere', nombre: 'Com Pró', rol: 'CLIENTE', passwordHash: 'x' } });
    await carritoDe(comprador.id, 3 * HORA);
    await ctx.prisma.pedido.create({
      data: {
        numero: 'VD-70001',
        userId: comprador.id,
        email: comprador.email,
        nombre: comprador.nombre,
        dni: '1',
        telefono: '1',
        modalidad: 'RETIRO_OPTICA',
        direccion: 'x',
        localidad: 'x',
        provincia: 'x',
        codigoPostal: '1000',
        subtotal: 1,
        total: 1,
        metodoPago: 'TRANSFERENCIA',
      },
    });
    expect(await jobCarritoAbandonado(ctx.app.env, ahora)).toBe(0);
    expect((await ctx.prisma.carrito.findUniqueOrThrow({ where: { userId: comprador.id } })).aviso1hEn).not.toBeNull();

    // Apagado desde la config.
    await ctx.prisma.configTienda.update({ where: { id: 'default' }, data: { carritoAbandonadoHabilitado: false } });
    await carritoDe(ctx.ids.cliente, 2 * HORA);
    expect(await jobCarritoAbandonado(ctx.app.env, ahora)).toBe(0);
    await ctx.prisma.configTienda.update({ where: { id: 'default' }, data: { carritoAbandonadoHabilitado: true } });
  });

  it('volvió el stock: avisa sólo cuando hay stock y una vez por aviso', async () => {
    const carey = await ctx.prisma.variante.findUniqueOrThrow({ where: { sku: 'P6-SOL-A-CAR' } });
    const alta = await ctx.inject('POST', '/catalogo/avisos-stock', undefined, { email: 'quiero@p6.vedere', varianteId: carey.id });
    expect(alta.statusCode).toBe(201);
    expect(await jobVolvioStock(ctx.app.env)).toBe(0);

    await ctx.prisma.variante.update({ where: { id: carey.id }, data: { stock: 3 } });
    expect(await jobVolvioStock(ctx.app.env)).toBe(1);
    expect(await jobVolvioStock(ctx.app.env)).toBe(0);
    const emails = await emailsDe(ctx.prisma, { tipo: 'VOLVIO_STOCK' });
    expect(emails).toHaveLength(1);
    expect(emails[0]!.para).toBe('quiero@p6.vedere');
    expect(emails[0]!.asunto).toBe('Volvió: Sol A Carey');
    expect((await ctx.prisma.avisoStock.findFirstOrThrow({ where: { email: 'quiero@p6.vedere' } })).notificadoEn).not.toBeNull();
  });

  it('Plan Rivedere: cupón de recambio y email a los N meses de la última compra de recetados, una vez', async () => {
    const pedido = await crearPedidoPagado(ctx, { items: [{ varianteId: ctx.ids.recetado, cantidad: 1 }] });
    const soloSol = await ctx.prisma.user.create({ data: { email: 'solsol@p6.vedere', nombre: 'Sol Sol', rol: 'CLIENTE', passwordHash: 'x' } });
    const ctxSol = { ...ctx, clienteCookie: { vedere_access: ctx.app.jwt.sign({ sub: soloSol.id, email: soloSol.email, rol: 'CLIENTE' }) } };
    await crearPedidoPagado(ctxSol, { email: soloSol.email, nombre: soloSol.nombre });

    const ahora = new Date();
    expect(await jobRivedere(ctx.app.env, ahora)).toBe(0); // la compra es de hoy

    const en25meses = new Date(ahora);
    en25meses.setMonth(en25meses.getMonth() + 25);
    expect(await jobRivedere(ctx.app.env, en25meses)).toBe(1);
    expect(await jobRivedere(ctx.app.env, en25meses)).toBe(0);

    const emails = await emailsDe(ctx.prisma, { tipo: 'PLAN_RIVEDERE' });
    expect(emails).toHaveLength(1);
    expect(emails[0]!.para).toBe('cli@p6.vedere');
    const cupon = await ctx.prisma.cupon.findFirstOrThrow({ where: { codigo: { startsWith: 'RIVEDERE-' } } });
    expect(cupon.tipo).toBe('PORCENTAJE');
    expect(Number(cupon.valor)).toBe(15);
    expect(cupon.usosMaxPorCliente).toBe(1);
    expect(cupon.vigenciaHasta!.getTime()).toBeGreaterThan(en25meses.getTime());
    const u = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.ids.cliente } });
    expect(u.rivedereAvisadoEn).not.toBeNull();

    // Una nueva compra de recetados reinicia el ciclo: 2 años después vuelve a avisar.
    await crearPedidoPagado(ctx, { items: [{ varianteId: ctx.ids.recetado, cantidad: 1 }] });
    await ctx.prisma.$executeRaw`UPDATE pedidos SET pagado_en = ${new Date(en25meses.getTime() + 86400_000)} WHERE numero <> ${pedido.numero} AND user_id = ${ctx.ids.cliente}`;
    const en51meses = new Date(ahora);
    en51meses.setMonth(en51meses.getMonth() + 51);
    expect(await jobRivedere(ctx.app.env, en51meses)).toBe(1);
    expect(await emailsDe(ctx.prisma, { tipo: 'PLAN_RIVEDERE' })).toHaveLength(2);
  });

  it('POST /jobs/:nombre exige x-cron-secret y devuelve cuántos emails mandó', async () => {
    expect((await ctx.inject('POST', '/jobs/volvio-stock')).statusCode).toBe(403);
    expect((await ctx.inject('POST', '/jobs/volvio-stock', undefined, undefined, { 'x-cron-secret': 'otro' })).statusCode).toBe(403);
    const lista = await ctx.inject('GET', '/jobs', undefined, undefined, { 'x-cron-secret': CRON });
    expect(lista.json().items).toEqual(['carrito-abandonado', 'volvio-stock', 'rivedere']);
    const ok = await ctx.inject('POST', '/jobs/volvio-stock', undefined, undefined, { 'x-cron-secret': CRON });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ job: 'volvio-stock', enviados: 0 });
    expect((await ctx.inject('POST', '/jobs/inexistente', undefined, undefined, { 'x-cron-secret': CRON })).statusCode).toBe(404);
  });
});
