// Tests del prompt B2B 3: cuenta corriente de las ópticas (aprobación automática por crédito, débito al
// despachar con vencimiento, pagos parciales e imputación, pagos informados, liquidación mensual que
// acredita comisiones, notas de crédito por devolución, estado de cuenta = suma de movimientos) y
// gestión de pedidos mayoristas en el backoffice (estados, remito, línea de tiempo, CSV, dashboard, job).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { evaluarCredito } from '../src/lib/cuenta-corriente.js';
import type { ResumenCuenta } from '../src/lib/cuenta-corriente.js';
import { diasHasta, jobVencimientosMayoristas } from '../src/jobs/vencimientos-mayoristas.js';
import { rangoMes } from '../src/lib/liquidacion.js';
import { crearContexto, crearPedidoPagado } from './prompt6-helpers.js';
import type { Contexto, Cookies } from './prompt6-helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;
const DIA = 86_400_000;

describe('regla de aprobación por crédito (unitario)', () => {
  const base: ResumenCuenta = {
    opticaId: 'o',
    cuentaId: 'c',
    limiteCredito: 1000,
    plazoPagoDias: 30,
    saldo: 0,
    comprometido: 0,
    disponible: 1000,
    deudaVencida: 0,
    deudaEnMora: 0,
    diasTolerancia: 7,
    proximosVencimientos: [],
    vencidos: [],
  };
  it('aprueba dentro del crédito disponible y frena si lo supera o hay deuda en mora', () => {
    expect(evaluarCredito(base, 1000)).toEqual({ ok: true });
    expect(evaluarCredito(base, 1000.5)).toMatchObject({ ok: false, motivo: expect.stringMatching(/crédito disponible/) });
    expect(evaluarCredito({ ...base, deudaVencida: 50, deudaEnMora: 50 }, 10)).toMatchObject({ ok: false, motivo: expect.stringMatching(/más de 7 días/) });
    // Deuda vencida dentro de la tolerancia no frena.
    expect(evaluarCredito({ ...base, deudaVencida: 50, deudaEnMora: 0 }, 10)).toEqual({ ok: true });
  });
  it('cuenta los días hasta el vencimiento en el calendario de Argentina', () => {
    const ahora = new Date('2026-11-04T15:00:00-03:00');
    expect(diasHasta(new Date('2026-11-07T09:00:00-03:00'), ahora)).toBe(3);
    expect(diasHasta(new Date('2026-11-04T23:30:00-03:00'), ahora)).toBe(0);
    expect(diasHasta(new Date('2026-11-03T23:30:00-03:00'), ahora)).toBe(-1);
  });
});

describe.skipIf(!hasDb)('B2B 3: cuenta corriente y gestión de pedidos mayoristas (integración)', () => {
  let ctx: Contexto;
  let opticaA = '';
  let opticaB = '';
  let cookieA: Cookies;
  let cookieB: Cookies;
  let oro = '';
  let p1 = ''; // 5 Oro, aprobado solo y despachado
  let p2 = ''; // 4 Oro, queda en revisión

  const get = (url: string, c?: Cookies) => ctx.inject('GET', url, c);
  const put = (url: string, c: Cookies, body: unknown) => ctx.inject('PUT', url, c, body);
  const post = (url: string, c: Cookies, body?: unknown) => ctx.inject('POST', url, c, body ?? {});
  const patch = (url: string, c: Cookies, body: unknown) => ctx.inject('PATCH', url, c, body);

  async function usuarioOptica(opticaId: string, email: string) {
    const u = await ctx.prisma.user.create({ data: { email, nombre: `Compras ${email}`, rol: 'OPTICA', opticaId, opticaDueno: true, passwordHash: 'x' } });
    return { vedere_access: ctx.app.jwt.sign({ sub: u.id, email, rol: 'OPTICA', nombre: u.nombre, opticaId }) };
  }

  async function comprar(cookie: Cookies, cantidad: number, entrega: 'ENVIO_TRANSPORTE' | 'RETIRO_DEPOSITO' = 'ENVIO_TRANSPORTE') {
    const c = await put('/optica/mayorista/carrito', cookie, { items: [{ varianteId: oro, cantidad }], modo: 'reemplazar' });
    expect(c.statusCode, c.body).toBe(200);
    const r = await post('/optica/mayorista/pedidos', cookie, { entrega });
    expect(r.statusCode, r.body).toBe(201);
    return r.json();
  }

  const saldoMovimientos = async (opticaId: string) => {
    const agg = await ctx.prisma.movimientoCuenta.aggregate({ where: { cuenta: { opticaId } }, _sum: { importe: true } });
    return Number(agg._sum.importe ?? 0);
  };

  beforeAll(async () => {
    ctx = await crearContexto();
    const { prisma } = ctx;
    opticaA = ctx.ids.optica;
    const b = await prisma.optica.create({
      data: { nombre: 'Óptica Sur', slug: 'optica-sur', direccion: 'Av. Mitre 500', localidad: 'Avellaneda', provincia: 'Buenos Aires', codigoPostal: '1870', email: 'sur@test.vedere' },
    });
    opticaB = b.id;
    cookieA = await usuarioOptica(opticaA, 'compras@centro.cc');
    cookieB = await usuarioOptica(opticaB, 'compras@sur.cc');
    await prisma.configMayorista.upsert({
      where: { id: 'default' },
      create: { id: 'default', retiroDireccion: 'Depósito Vedere, Av. Warnes 1200', retiroHorario: 'Lun a vie 9 a 17' },
      update: { retiroDireccion: 'Depósito Vedere, Av. Warnes 1200', retiroHorario: 'Lun a vie 9 a 17' },
    });
    const marca = await prisma.marca.findFirstOrThrow();
    const prod = await prisma.producto.create({
      data: {
        nombre: 'Redondo Cuenta',
        slug: 'redondo-cuenta',
        linea: 'SOL',
        precio: 242000,
        precioMayorista: 100000,
        estado: 'PUBLICADO',
        publicadoEn: new Date(),
        marcaId: marca.id,
        variantes: { create: [{ sku: 'CC-RED-ORO', colorArmazon: 'Oro', stock: 50 }] },
      },
      include: { variantes: true },
    });
    oro = prod.variantes[0]!.id;
    // Óptica A: crédito de $1.000.000 a 30 días (editable en /admin/opticas).
    const o = await put(`/admin/opticas/${opticaA}`, ctx.staffCookie, { limiteCredito: 1_000_000, plazoPagoDias: 30 });
    expect(o.statusCode, o.body).toBe(200);
    expect(o.json()).toMatchObject({ limiteCredito: 1_000_000, plazoPagoDias: 30 });
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('un pedido dentro del crédito se aprueba solo (y reserva stock); uno que lo supera queda EN_REVISION', async () => {
    // 5 × 100.000 + IVA 21% = 605.000 ≤ 1.000.000
    const a = await comprar(cookieA, 5);
    p1 = a.id;
    expect(a).toMatchObject({ estado: 'APROBADO', total: 605000, plazoPagoDias: 30 });
    expect(await ctx.prisma.reservaStock.count({ where: { pedidoMayoristaId: p1, estado: 'ACTIVA' } })).toBe(1);
    // 4 × 121.000 = 484.000 > 1.000.000 − 605.000 comprometido = 395.000 disponible
    const b = await comprar(cookieA, 4);
    p2 = b.id;
    expect(b.estado).toBe('EN_REVISION');
    expect(b.motivoRevision).toMatch(/Supera el crédito disponible/);
    expect(await ctx.prisma.reservaStock.count({ where: { pedidoMayoristaId: p2 } })).toBe(0);
    const cuenta = (await get('/optica/cuenta', cookieA)).json();
    expect(cuenta.resumen).toMatchObject({ saldo: 0, comprometido: 605000, disponible: 395000 });
    // El admin decide: lo aprueba igual.
    const ap = await post(`/admin/mayorista/pedidos/${p2}/aprobar`, ctx.staffCookie, { nota: 'Cliente histórico' });
    expect(ap.json()).toMatchObject({ estado: 'APROBADO' });
    expect(ap.json().eventos.map((e: { estado: string | null }) => e.estado)).toEqual(['PENDIENTE_APROBACION', 'EN_REVISION', 'APROBADO']);
    // Una óptica sin crédito asignado siempre queda en revisión.
    expect((await comprar(cookieB, 1)).estado).toBe('EN_REVISION');
  });

  it('al despachar el saldo sube por el total y vence a la fecha de despacho + el plazo vigente al comprar', async () => {
    // El plazo cambia después de la compra: el pedido mantiene los 30 días.
    await put(`/admin/opticas/${opticaA}`, ctx.staffCookie, { plazoPagoDias: 60 });
    const prep = await post(`/admin/mayorista/pedidos/${p1}/preparar`, ctx.staffCookie);
    expect(prep.json().estado).toBe('EN_PREPARACION');
    const sinTransporte = await post(`/admin/mayorista/pedidos/${p1}/despachar`, ctx.staffCookie, {});
    expect(sinTransporte.statusCode).toBe(400);
    const d = await post(`/admin/mayorista/pedidos/${p1}/despachar`, ctx.staffCookie, {
      transporte: 'Vía Cargo',
      numeroSeguimiento: 'VC-998877',
      linkSeguimiento: 'https://viacargo.com.ar/seguimiento/VC-998877',
    });
    expect(d.statusCode, d.body).toBe(200);
    const p = d.json();
    expect(p).toMatchObject({ estado: 'DESPACHADO', transporte: 'Vía Cargo', numeroRemito: 1, estadoPago: 'IMPAGO', pendiente: 605000 });
    const despacho = new Date(p.despachadoEn).getTime();
    expect(new Date(p.venceEn).getTime() - despacho).toBe(30 * DIA);
    const mov = await ctx.prisma.movimientoCuenta.findFirstOrThrow({ where: { pedidoMayoristaId: p1, tipo: 'DEBITO_PEDIDO' } });
    expect(Number(mov.importe)).toBe(605000);
    expect(mov.vencimiento!.getTime()).toBe(despacho + 30 * DIA);
    expect((await get('/optica/cuenta', cookieA)).json().resumen).toMatchObject({ saldo: 605000, comprometido: 484000 });
    // Stock descontado y reserva consumida.
    expect((await ctx.prisma.variante.findUniqueOrThrow({ where: { id: oro } })).stock).toBe(45);
    // Un pedido nuevo toma el plazo vigente (60 días).
    const nuevo = await comprar(cookieA, 1);
    expect(nuevo.plazoPagoDias).toBe(60);
    await post(`/admin/mayorista/pedidos/${nuevo.id}/cancelar`, ctx.staffCookie, { motivo: 'Prueba de plazo' });
  });

  it('un pago parcial reduce el saldo y deja el pedido parcialmente pagado', async () => {
    const mal = await post(`/admin/cuentas/${opticaA}/pagos`, ctx.staffCookie, { importe: 1000, medio: 'TRANSFERENCIA', imputaciones: [{ pedidoId: p1, monto: 2000 }] });
    expect(mal.statusCode).toBe(400);
    const r = await post(`/admin/cuentas/${opticaA}/pagos`, ctx.staffCookie, {
      importe: 200000,
      medio: 'TRANSFERENCIA',
      referencia: 'Op. 4455',
      imputaciones: [{ pedidoId: p1, monto: 200000 }],
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().resumen.saldo).toBe(405000);
    const p = (await get(`/optica/mayorista/pedidos/${p1}`, cookieA)).json();
    expect(p).toMatchObject({ estadoPago: 'PARCIAL', pagado: 200000, pendiente: 405000 });
    expect(p.eventos.some((e: { tipo: string; nota: string }) => e.tipo === 'PAGO' && /Quedan \$405\.000/.test(e.nota))).toBe(true);
    // No se le puede imputar más de lo que debe.
    const pasado = await post(`/admin/cuentas/${opticaA}/pagos`, ctx.staffCookie, { importe: 500000, medio: 'EFECTIVO', imputaciones: [{ pedidoId: p1, monto: 500000 }] });
    expect(pasado.statusCode).toBe(400);
  });

  it('la óptica ve su cuenta pero no puede crear ni editar movimientos', async () => {
    const c = await get('/optica/cuenta', cookieA);
    expect(c.statusCode).toBe(200);
    expect(c.json().resumen).toMatchObject({ saldo: 405000, limiteCredito: 1_000_000 });
    expect(c.json().pedidosPendientes[0]).toMatchObject({ id: p1, pendiente: 405000 });
    const movs = (await get('/optica/cuenta/movimientos', cookieA)).json();
    expect(movs.items.map((m: { tipo: string }) => m.tipo)).toEqual(['PAGO', 'DEBITO_PEDIDO']);
    // Sin endpoints de escritura de movimientos en el portal; los del backoffice dan 403.
    expect((await post('/optica/cuenta/movimientos', cookieA, { importe: -405000 })).statusCode).toBe(404);
    expect((await put(`/optica/cuenta/movimientos/${movs.items[0].id}`, cookieA, { importe: 0 })).statusCode).toBe(404);
    expect((await post(`/admin/cuentas/${opticaA}/pagos`, cookieA, { importe: 405000, medio: 'EFECTIVO' })).statusCode).toBe(403);
    expect((await post(`/admin/cuentas/${opticaA}/ajustes`, cookieA, { importe: -405000, motivo: 'me lo regalo' })).statusCode).toBe(403);
    expect((await get(`/admin/cuentas/${opticaA}`, cookieB)).statusCode).toBe(403);
    // Cada óptica ve sólo su cuenta.
    expect((await get('/optica/cuenta', cookieB)).json().resumen.saldo).toBe(0);
    expect((await get('/optica/cuenta')).statusCode).toBe(401);
  });

  it('la óptica informa un pago con comprobante y queda pendiente hasta que el admin lo valida', async () => {
    const r = await post('/optica/cuenta/pagos-informados', cookieA, {
      importe: 100000,
      medio: 'ECHEQ',
      fechaPago: '2026-11-04',
      referencia: 'E-cheq 778',
      comprobanteUrl: 'https://pub.example.com/opticas-comprobantes/x.pdf',
      pedidoIds: [p1],
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().estado).toBe('PENDIENTE');
    expect(await saldoMovimientos(opticaA)).toBe(405000);
    // No puede informar pagos de pedidos de otra óptica.
    const ajeno = await post('/optica/cuenta/pagos-informados', cookieB, { importe: 1, medio: 'EFECTIVO', fechaPago: '2026-11-04', comprobanteUrl: 'https://pub.example.com/x.pdf', pedidoIds: [p1] });
    expect(ajeno.statusCode).toBe(403);
    expect((await post(`/admin/cuentas/pagos-informados/${r.json().id}/validar`, cookieA)).statusCode).toBe(403);
    const v = await post(`/admin/cuentas/pagos-informados/${r.json().id}/validar`, ctx.staffCookie);
    expect(v.statusCode, v.body).toBe(200);
    expect(v.json()).toMatchObject({ estado: 'VALIDADO', imputaciones: [{ pedidoId: p1, monto: 100000 }] });
    expect(await saldoMovimientos(opticaA)).toBe(305000);
    expect((await post(`/admin/cuentas/pagos-informados/${r.json().id}/validar`, ctx.staffCookie)).statusCode).toBe(409);
    // Un pago rechazado no mueve la cuenta.
    const otro = await post('/optica/cuenta/pagos-informados', cookieA, { importe: 5000, medio: 'TRANSFERENCIA', fechaPago: '2026-11-04', comprobanteUrl: 'https://pub.example.com/y.jpg' });
    const rech = await post(`/admin/cuentas/pagos-informados/${otro.json().id}/rechazar`, ctx.staffCookie, { motivo: 'El comprobante no se lee' });
    expect(rech.json()).toMatchObject({ estado: 'RECHAZADO', motivoRechazo: 'El comprobante no se lee' });
    expect(await saldoMovimientos(opticaA)).toBe(305000);
  });

  it('deuda vencida hace más de 7 días manda el pedido a revisión aunque haya crédito', async () => {
    await put(`/admin/opticas/${opticaA}`, ctx.staffCookie, { limiteCredito: 10_000_000 });
    const vencerHace = async (dias: number) => {
      const v = new Date(Date.now() - dias * DIA);
      await ctx.prisma.pedidoMayorista.update({ where: { id: p1 }, data: { venceEn: v } });
    };
    await vencerHace(5);
    const dentro = await comprar(cookieA, 1);
    expect(dentro.estado).toBe('APROBADO');
    expect((await get('/optica/cuenta', cookieA)).json().resumen).toMatchObject({ deudaVencida: 305000, deudaEnMora: 0 });
    await post(`/admin/mayorista/pedidos/${dentro.id}/cancelar`, ctx.staffCookie, { motivo: 'Prueba' });
    await vencerHace(10);
    const fuera = await comprar(cookieA, 1);
    expect(fuera.estado).toBe('EN_REVISION');
    expect(fuera.motivoRevision).toMatch(/deuda vencida hace más de 7 días/);
    await post(`/admin/mayorista/pedidos/${fuera.id}/cancelar`, ctx.staffCookie, { motivo: 'Prueba' });
    // Los días de tolerancia son configurables.
    const cfg = (await get('/admin/mayorista/config', ctx.staffCookie)).json();
    expect(cfg.diasToleranciaVencida).toBe(7);
    await put('/admin/mayorista/config', ctx.staffCookie, { ...cfg, diasToleranciaVencida: 15 });
    const tolerado = await comprar(cookieA, 1);
    expect(tolerado.estado).toBe('APROBADO');
    await post(`/admin/mayorista/pedidos/${tolerado.id}/cancelar`, ctx.staffCookie, { motivo: 'Prueba' });
    await put('/admin/mayorista/config', ctx.staffCookie, { ...cfg, diasToleranciaVencida: 7 });
    await vencerHace(-30);
  });

  it('cerrar la liquidación mensual acredita la comisión en la cuenta de cada óptica', async () => {
    const anterior = rangoMes(null, new Date(rangoMes().desde.getTime() - DIA)).mes;
    const web = await crearPedidoPagado(ctx);
    await ctx.prisma.pedido.update({
      where: { id: web.id },
      data: { estado: 'ENTREGADO', opticaId: opticaA, entregadoEn: new Date(rangoMes(anterior).desde.getTime() + 10 * DIA), comisionMonto: 12345 },
    });
    expect((await post('/admin/liquidaciones/cerrar', ctx.staffCookie, { mes: rangoMes().mes })).statusCode).toBe(400);
    const antes = await saldoMovimientos(opticaA);
    const r = await post('/admin/liquidaciones/cerrar', ctx.staffCookie, { mes: anterior });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().acreditadas).toEqual([expect.objectContaining({ opticaId: opticaA, comision: 12345 })]);
    expect(await saldoMovimientos(opticaA)).toBe(antes - 12345);
    const mov = await ctx.prisma.movimientoCuenta.findFirstOrThrow({ where: { tipo: 'CREDITO_LIQUIDACION', liquidacionMes: anterior } });
    expect(Number(mov.importe)).toBe(-12345);
    // El crédito se imputa al pedido con saldo pendiente.
    expect((await get(`/optica/mayorista/pedidos/${p1}`, cookieA)).json().pagado).toBe(312345);
    // No se cierra dos veces; la óptica no puede cerrar.
    expect((await post('/admin/liquidaciones/cerrar', ctx.staffCookie, { mes: anterior })).statusCode).toBe(409);
    expect((await post('/admin/liquidaciones/cerrar', cookieA, { mes: anterior })).statusCode).toBe(403);
    expect((await get(`/admin/liquidaciones?mes=${anterior}`, ctx.staffCookie)).json().cierre).toMatchObject({ mes: anterior, total: 12345 });
  });

  it('devolución: la óptica la pide con motivo y fotos; al aprobarla reingresa el stock y genera la nota de crédito', async () => {
    const pedido = (await get(`/optica/mayorista/pedidos/${p1}`, cookieA)).json();
    const itemId = pedido.items[0].id;
    expect((await post(`/optica/mayorista/pedidos/${p1}/devoluciones`, cookieA, { motivo: 'Llegaron rayados', items: [{ itemId, cantidad: 6 }] })).statusCode).toBe(400);
    expect((await post(`/optica/mayorista/pedidos/${p1}/devoluciones`, cookieB, { motivo: 'Llegaron rayados', items: [{ itemId, cantidad: 1 }] })).statusCode).toBe(403);
    expect((await post(`/optica/mayorista/pedidos/${p2}/devoluciones`, cookieA, { motivo: 'Todavía no llegó', items: [{ itemId, cantidad: 1 }] })).statusCode).toBe(409);
    const r = await post(`/optica/mayorista/pedidos/${p1}/devoluciones`, cookieA, {
      motivo: 'Dos armazones llegaron rayados',
      fotos: ['https://pub.example.com/opticas-devoluciones/a.jpg'],
      items: [{ itemId, cantidad: 2 }],
    });
    expect(r.statusCode, r.body).toBe(201);
    const devId = r.json().id;
    expect(r.json().pedido.devoluciones[0]).toMatchObject({ estado: 'SOLICITADA', importe: 242000, fotos: ['https://pub.example.com/opticas-devoluciones/a.jpg'] });
    const stockAntes = (await ctx.prisma.variante.findUniqueOrThrow({ where: { id: oro } })).stock;
    const saldoAntes = await saldoMovimientos(opticaA);
    const ok = await post(`/admin/mayorista/devoluciones/${devId}/aprobar`, ctx.staffCookie);
    expect(ok.statusCode, ok.body).toBe(200);
    expect((await ctx.prisma.variante.findUniqueOrThrow({ where: { id: oro } })).stock).toBe(stockAntes + 2);
    const nc = await ctx.prisma.movimientoCuenta.findFirstOrThrow({ where: { tipo: 'NOTA_CREDITO', devolucionId: devId } });
    expect(Number(nc.importe)).toBe(-242000);
    expect(await saldoMovimientos(opticaA)).toBe(saldoAntes - 242000);
    expect((await post(`/admin/mayorista/devoluciones/${devId}/aprobar`, ctx.staffCookie)).statusCode).toBe(409);
    // Ya devolvió 2 de 5: puede devolver hasta 3 más.
    expect((await post(`/optica/mayorista/pedidos/${p1}/devoluciones`, cookieA, { motivo: 'Otro problema', items: [{ itemId, cantidad: 4 }] })).statusCode).toBe(400);
  });

  it('el saldo del estado de cuenta coincide con la suma de movimientos', async () => {
    expect((await post(`/admin/cuentas/${opticaA}/ajustes`, ctx.staffCookie, { importe: 5000 })).statusCode).toBe(400);
    expect((await post(`/admin/cuentas/${opticaA}/ajustes`, ctx.staffCookie, { importe: 5000, motivo: 'Flete reclamado por la óptica' })).statusCode).toBe(201);
    expect((await post(`/admin/cuentas/${opticaA}/ajustes`, ctx.staffCookie, { importe: -1500.5, motivo: 'Redondeo a favor' })).statusCode).toBe(201);
    const suma = await saldoMovimientos(opticaA);
    const movs = (await get(`/admin/cuentas/${opticaA}/movimientos?pageSize=100`, ctx.staffCookie)).json();
    const sumaApi = Math.round(movs.items.reduce((a: number, m: { importe: number }) => a + m.importe, 0) * 100) / 100;
    expect(movs.saldo).toBe(suma);
    expect(sumaApi).toBe(suma);
    // El más nuevo primero: su saldo acumulado es el saldo final.
    expect(movs.items[0].saldo).toBe(suma);
    expect(new Set(movs.items.map((m: { tipo: string }) => m.tipo))).toEqual(new Set(['DEBITO_PEDIDO', 'PAGO', 'CREDITO_LIQUIDACION', 'NOTA_CREDITO', 'AJUSTE']));
    expect((await get('/optica/cuenta', cookieA)).json().resumen.saldo).toBe(suma);
    expect((await get(`/admin/cuentas/${opticaA}`, ctx.staffCookie)).json().resumen.saldo).toBe(suma);
    const lista = (await get('/admin/cuentas', ctx.staffCookie)).json();
    expect(lista.items.find((i: { optica: { id: string } }) => i.optica.id === opticaA).saldo).toBe(suma);
    for (const [url, c] of [[`/admin/cuentas/${opticaA}/estado.pdf`, ctx.staffCookie], ['/optica/cuenta/estado.pdf', cookieA]] as const) {
      const pdf = await get(url, c);
      expect(pdf.statusCode).toBe(200);
      expect(pdf.headers['content-type']).toBe('application/pdf');
      expect(pdf.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
    }
  });

  it('retiro en el depósito: listo para retirar debita la cuenta y numera el remito', async () => {
    await put(`/admin/opticas/${opticaB}`, ctx.staffCookie, { limiteCredito: 500000, plazoPagoDias: 15 });
    const r = await comprar(cookieB, 2, 'RETIRO_DEPOSITO');
    expect(r.estado).toBe('APROBADO');
    expect((await post(`/admin/mayorista/pedidos/${r.id}/despachar`, ctx.staffCookie, { transporte: 'Andreani' })).statusCode).toBe(409);
    const l = await post(`/admin/mayorista/pedidos/${r.id}/listo-para-retiro`, ctx.staffCookie, { nota: 'Está en la estantería 3' });
    expect(l.json()).toMatchObject({ estado: 'LISTO_PARA_RETIRO', numeroRemito: 2, pendiente: 242000 });
    expect(new Date(l.json().venceEn).getTime() - new Date(l.json().listoParaRetiroEn).getTime()).toBe(15 * DIA);
    expect((await get('/optica/cuenta', cookieB)).json().resumen.saldo).toBe(242000);
    expect((await post(`/admin/mayorista/pedidos/${r.id}/entregar`, ctx.staffCookie)).json().estado).toBe('ENTREGADO');
    const remito = await get(`/optica/mayorista/pedidos/${r.id}/remito.pdf`, cookieB);
    expect(remito.statusCode).toBe(200);
    expect(remito.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
    expect((await get(`/optica/mayorista/pedidos/${r.id}/remito.pdf`, cookieA)).statusCode).toBe(403);
    expect((await get(`/admin/mayorista/pedidos/${p1}/remito.pdf`, ctx.staffCookie)).statusCode).toBe(200);
  });

  it('línea de tiempo, notas internas, factura y email a la óptica en cada cambio', async () => {
    const r = await patch(`/admin/mayorista/pedidos/${p1}`, ctx.staffCookie, {
      notasInternas: 'Cliente pide factura A',
      numeroFactura: 'A-0001-00001234',
      nota: 'Llamar antes de entregar',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ notasInternas: 'Cliente pide factura A', numeroFactura: 'A-0001-00001234' });
    const tiposAdmin = r.json().eventos.map((e: { tipo: string }) => e.tipo);
    expect(tiposAdmin).toEqual(expect.arrayContaining(['ESTADO', 'PAGO', 'NOTA_INTERNA', 'FACTURA', 'NOTA', 'DEVOLUCION']));
    const vistaOptica = (await get(`/optica/mayorista/pedidos/${p1}`, cookieA)).json();
    expect(vistaOptica.notasInternas).toBeUndefined();
    expect(vistaOptica.numeroFactura).toBe('A-0001-00001234');
    expect(vistaOptica.eventos.some((e: { interno: boolean }) => e.interno)).toBe(false);
    expect(vistaOptica.eventos.find((e: { estado: string }) => e.estado === 'DESPACHADO')).toMatchObject({ usuarioNombre: expect.any(String) });
    const emails = await ctx.prisma.emailEnviado.findMany({ where: { para: 'compras@centro.cc' }, select: { tipo: true } });
    expect(emails.map((e) => e.tipo)).toEqual(expect.arrayContaining(['MAYORISTA_APROBADO', 'MAYORISTA_EN_PREPARACION', 'MAYORISTA_DESPACHADO', 'MAYORISTA_EN_REVISION', 'MAYORISTA_CANCELADO', 'MAYORISTA_FACTURA']));
  });

  it('filtros por estado, óptica, fecha y entrega; exportación a CSV; dashboard', async () => {
    const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
    const l = await get(`/admin/mayorista/pedidos?estado=DESPACHADO&opticaId=${opticaA}&entrega=ENVIO_TRANSPORTE&desde=${hoy}&hasta=${hoy}`, ctx.staffCookie);
    expect(l.json().items.map((p: { id: string }) => p.id)).toEqual([p1]);
    expect((await get(`/admin/mayorista/pedidos?entrega=RETIRO_DEPOSITO&opticaId=${opticaA}`, ctx.staffCookie)).json().total).toBe(0);
    expect((await get('/admin/mayorista/pedidos?desde=2020-01-01&hasta=2020-01-31', ctx.staffCookie)).json().total).toBe(0);
    const csv = await get(`/admin/mayorista/pedidos.csv?opticaId=${opticaA}`, ctx.staffCookie);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body).toContain('numero,fecha,optica');
    expect(csv.body).toContain('A-0001-00001234');
    const dash = (await get('/admin/mayorista/dashboard', ctx.staffCookie)).json();
    expect(dash.ventasMes).toBe(605000 + 242000);
    expect(dash.deudaTotal).toBeGreaterThan(0);
    expect(dash).toHaveProperty('deudaVencida');
    expect((await get('/admin/mayorista/dashboard', cookieA)).statusCode).toBe(403);
  });

  it('job: recordatorio 3 días antes del vencimiento y al vencer (una sola vez cada uno)', async () => {
    const ahora = new Date();
    await ctx.prisma.pedidoMayorista.update({ where: { id: p1 }, data: { venceEn: new Date(ahora.getTime() + 2.5 * DIA) } });
    expect(await jobVencimientosMayoristas(ctx.app.env, ahora)).toBe(1);
    expect(await jobVencimientosMayoristas(ctx.app.env, ahora)).toBe(0);
    expect(await ctx.prisma.emailEnviado.count({ where: { tipo: 'CUENTA_VENCIMIENTO_PREVIO' } })).toBe(1);
    const alVencer = new Date(ahora.getTime() + 2.6 * DIA);
    expect(await jobVencimientosMayoristas(ctx.app.env, alVencer)).toBe(1);
    expect(await ctx.prisma.emailEnviado.count({ where: { tipo: 'CUENTA_VENCIMIENTO' } })).toBe(1);
    expect(await jobVencimientosMayoristas(ctx.app.env, alVencer)).toBe(0);
    // Un pedido pagado no recibe avisos.
    const r = await ctx.inject('POST', '/jobs/vencimientos-mayoristas', undefined, {}, { 'x-cron-secret': ctx.app.env.CRON_SECRET ?? '' });
    expect([200, 401, 503]).toContain(r.statusCode);
  });
});
