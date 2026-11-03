// Tests de integración del checkout (prompt 4) contra TEST_DATABASE_URL: cotización con promos y
// cupón, receta obligatoria, pedido con Mercado Pago aprobado por webhook (idempotente), reserva y
// liberación de stock, transferencia pendiente aprobada por el admin, y ABM de promociones/creadores/config.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@vedere/db';
import { firmarWebhook } from '../src/lib/mercadopago.js';
import { testEnv } from './helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;
const MP_SECRET = 'secreto-webhook-de-prueba';

describe.skipIf(!hasDb)('checkout (integración)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let staffCookie: Record<string, string>;
  let clienteCookie: Record<string, string>;
  let clienteId = '';
  const ids = { optica: '', solA: '', solB: '', recetado: '', coleccion: '' };
  const realFetch = globalThis.fetch;

  /** Simula la API de Mercado Pago: preferencias y consulta de pagos. */
  const pagosMP = new Map<string, { status: string; external_reference: string; transaction_amount: number }>();
  function stubMP() {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith('https://api.mercadopago.com/checkout/preferences')) {
        const body = JSON.parse(String(init?.body)) as { external_reference: string };
        return new Response(
          JSON.stringify({ id: `pref-${body.external_reference}`, init_point: `https://mp.test/pay/${body.external_reference}` }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }
      const m = /^https:\/\/api\.mercadopago\.com\/v1\/payments\/(\d+)$/.exec(url);
      if (m) {
        const pago = pagosMP.get(m[1]!);
        if (!pago) return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
        return new Response(
          JSON.stringify({ id: Number(m[1]), ...pago, installments: 6, payment_method_id: 'visa', payment_type_id: 'credit_card' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return realFetch(input, init);
    });
  }

  const direccion = {
    direccion: 'Av. Santa Fe 4100',
    localidad: 'Palermo',
    provincia: 'Buenos Aires',
    codigoPostal: '1425',
    lat: -34.585,
    lng: -58.42,
  };
  const datos = { email: 'comprador@test.vedere', nombre: 'Ana Pérez', dni: '30123456', telefono: '+54 11 5555-1234' };

  beforeAll(async () => {
    const db = await import('@vedere/db');
    prisma = db.prisma;
    const { buildApp } = await import('../src/app.js');
    app = await buildApp({
      env: testEnv({
        DATABASE_URL: process.env.TEST_DATABASE_URL!,
        STORAGE_DRIVER: 'local',
        MP_ACCESS_TOKEN: 'TEST-token-de-prueba',
        MP_WEBHOOK_SECRET: MP_SECRET,
        RESERVA_STOCK_MINUTOS: '30',
      }),
      logger: false,
    });
    await app.ready();

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE eventos_webhook, cupon_usos, reservas_stock, pagos, pedido_items, pedidos, recetas, promociones, creadores, config_tienda, avisos_stock, carritos, mensajes_contacto, suscripciones_newsletter, cupones, opticas, promo_mensajes, imagenes_variante, variantes, "_CategoriaToProducto", productos, categorias, marcas, colecciones, refresh_tokens, users RESTART IDENTITY CASCADE',
    );
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE pedidos_numero_seq RESTART WITH 10001`);

    const admin = await prisma.user.create({
      data: { email: 'admin@checkout.vedere', nombre: 'Admin', rol: 'ADMIN', passwordHash: 'x' },
    });
    const cliente = await prisma.user.create({
      data: { email: 'cli@checkout.vedere', nombre: 'Cli', rol: 'CLIENTE', passwordHash: 'x' },
    });
    clienteId = cliente.id;
    staffCookie = { vedere_access: app.jwt.sign({ sub: admin.id, email: admin.email, rol: 'ADMIN' }) };
    clienteCookie = { vedere_access: app.jwt.sign({ sub: cliente.id, email: cliente.email, rol: 'CLIENTE' }) };

    const optica = await prisma.optica.create({
      data: {
        nombre: 'Óptica Test',
        slug: 'optica-test',
        direccion: 'Calle 1',
        localidad: 'CABA',
        provincia: 'Buenos Aires',
        codigoPostal: '1425',
        lat: -34.58,
        lng: -58.42,
      },
    });
    ids.optica = optica.id;
    const col = await prisma.coleccion.create({ data: { nombre: 'Verano', slug: 'verano', colorHex: '#F2B33D' } });
    ids.coleccion = col.id;

    const crear = (nombre: string, slug: string, linea: 'SOL' | 'RECETADO', precio: number, sku: string, stock: number) =>
      prisma.producto.create({
        data: {
          nombre,
          slug,
          linea,
          precio,
          estado: 'PUBLICADO',
          publicadoEn: new Date(),
          coleccionId: col.id,
          permiteReceta: linea === 'RECETADO',
          variantes: { create: [{ sku, colorArmazon: 'Negro', stock }] },
        },
        include: { variantes: true },
      });
    ids.solA = (await crear('Sol A', 'sol-a', 'SOL', 90000, 'CK-SOL-A', 3)).variantes[0]!.id;
    ids.solB = (await crear('Sol B', 'sol-b', 'SOL', 60000, 'CK-SOL-B', 2)).variantes[0]!.id;
    ids.recetado = (await crear('Recetado R', 'recetado-r', 'RECETADO', 120000, 'CK-REC', 5)).variantes[0]!.id;

    await prisma.promocion.create({ data: { nombre: '2x1 en Sol', tipo: 'DOS_POR_UNO', linea: 'SOL', activa: true } });
    await prisma.promocion.create({ data: { nombre: 'Envío gratis desde 80k', tipo: 'ENVIO_GRATIS', montoMinimo: 80000, activa: true } });
    await prisma.cupon.create({ data: { codigo: 'DIEZ', tipo: 'PORCENTAJE', valor: 10, acumulable: true, usosMaxPorCliente: 1 } });
    await prisma.cupon.create({ data: { codigo: 'EXCLUSIVO', tipo: 'MONTO', valor: 5000 } });
    await prisma.configTienda.create({
      data: { id: 'default', descuentoTransferencia: 10, costoEnvio: 9900, cuotasPorLinea: { MULTIFOCAL: 12 }, cbu: '0170001540000001234567', alias: 'vedere.pagos' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /checkout/config expone transferencia, MP y cuotas', async () => {
    const res = await app.inject({ method: 'GET', url: '/checkout/config' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.mercadoPago).toBe(true);
    expect(body.transferencia.alias).toBe('vedere.pagos');
    expect(body.transferencia.descuento).toBe(10);
    expect(body.cuotas.cuotasPorLinea.MULTIFOCAL).toBe(12);
    expect(body.places).toBe(false);
  });

  it('POST /checkout/cotizar aplica 2x1 + cupón acumulable y detecta receta requerida', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/checkout/cotizar',
      payload: {
        items: [
          { varianteId: ids.solA, cantidad: 1 },
          { varianteId: ids.solB, cantidad: 1 },
          { varianteId: ids.recetado, cantidad: 1 },
        ],
        cupon: 'diez',
        modalidad: 'ENVIO_DOMICILIO',
      },
    });
    expect(res.statusCode).toBe(200);
    const c = res.json();
    expect(c.totales.subtotal).toBe(270000);
    expect(c.totales.descuentos.map((d: { tipo: string; monto: number }) => [d.tipo, d.monto])).toEqual([
      ['PROMO', 60000],
      ['CUPON', 21000], // 10 % de 210.000 netos
    ]);
    expect(c.totales.envio).toBe(0);
    expect(c.totales.envioGratisPor).toBe('Envío gratis desde 80k');
    expect(c.totales.total).toBe(189000);
    expect(c.requiereReceta).toBe(true);
    expect(c.cuotas.cantidad).toBe(6);
    expect(c.sinStock).toEqual([]);
    expect(c.cuponError).toBeNull();

    const excl = await app.inject({
      method: 'POST',
      url: '/checkout/cotizar',
      payload: { items: [{ varianteId: ids.solA, cantidad: 2 }], cupon: 'EXCLUSIVO' },
    });
    expect(excl.json().totales.descuentos).toHaveLength(1);
    expect(excl.json().totales.descuentos[0].tipo).toBe('PROMO');
    expect(excl.json().cuponError).toMatch(/no se combina/);
  });

  it('un recetado sin receta no deja crear el pedido', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/checkout/pedidos',
      payload: {
        datos,
        entrega: { modalidad: 'RETIRO_OPTICA', opticaId: ids.optica, direccion },
        pago: { metodo: 'TRANSFERENCIA' },
        items: [{ varianteId: ids.recetado, cantidad: 1 }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details[0].path).toBe('receta');

    const fuera = await app.inject({
      method: 'POST',
      url: '/checkout/pedidos',
      payload: {
        datos,
        entrega: { modalidad: 'RETIRO_OPTICA', opticaId: ids.optica, direccion },
        pago: { metodo: 'TRANSFERENCIA' },
        receta: { modo: 'VALORES', valores: { odEsfera: -25, oiEsfera: -1 } },
        items: [{ varianteId: ids.recetado, cantidad: 1 }],
      },
    });
    expect(fuera.statusCode).toBe(400);
    expect(fuera.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('compra con Mercado Pago: pedido PENDIENTE con reserva, webhook firmado lo APRUEBA y descuenta stock una sola vez', async () => {
    stubMP();
    const res = await app.inject({
      method: 'POST',
      url: '/checkout/pedidos',
      cookies: clienteCookie,
      payload: {
        datos,
        entrega: { modalidad: 'ENVIO_DOMICILIO', opticaId: ids.optica, direccion },
        receta: { modo: 'VALORES', valores: { odEsfera: -1.25, odCilindro: -0.5, odEje: 90, oiEsfera: -1, dp: 63 } },
        pago: { metodo: 'MERCADO_PAGO' },
        items: [
          { varianteId: ids.solA, cantidad: 2 },
          { varianteId: ids.recetado, cantidad: 1 },
        ],
        cupon: 'DIEZ',
      },
    });
    expect(res.statusCode).toBe(201);
    const { pedido, initPoint } = res.json();
    expect(pedido.numero).toBe('VD-10001');
    expect(pedido.estado).toBe('PENDIENTE_PAGO');
    expect(pedido.estadoPago).toBe('PENDIENTE');
    expect(initPoint).toBe(`https://mp.test/pay/${pedido.id}`);
    // 2x1 (90.000) + 10 % de (300.000 − 90.000) = 21.000; envío gratis por monto.
    expect(pedido.totales).toMatchObject({ subtotal: 300000, descuentos: 111000, envio: 0, total: 189000 });
    expect(pedido.receta.modo).toBe('VALORES');
    expect(pedido.receta.odEje).toBe(90);
    expect(pedido.entrega.optica.nombre).toBe('Óptica Test');
    expect(pedido.entrega.lat).toBe(-34.585);

    // Receta guardada en la cuenta del cliente.
    const recetas = await prisma.receta.findMany({ where: { userId: clienteId } });
    expect(recetas).toHaveLength(1);

    // Stock físico intacto, pero reservado: otro carrito con 2 Sol A no tiene disponibilidad.
    const solA = await prisma.variante.findUniqueOrThrow({ where: { id: ids.solA } });
    expect(solA.stock).toBe(3);
    const cot = await app.inject({
      method: 'POST',
      url: '/checkout/cotizar',
      payload: { items: [{ varianteId: ids.solA, cantidad: 2 }] },
    });
    expect(cot.json().sinStock).toEqual([{ varianteId: ids.solA, disponible: 1 }]);

    // Webhook sin firma válida → 401.
    pagosMP.set('5001', { status: 'approved', external_reference: pedido.id, transaction_amount: 189000 });
    const malo = await app.inject({
      method: 'POST',
      url: '/checkout/mercadopago/webhook?data.id=5001&type=payment',
      headers: { 'x-signature': 'ts=1,v1=deadbeef', 'x-request-id': 'req-1' },
      payload: { type: 'payment', action: 'payment.updated', data: { id: '5001' } },
    });
    expect(malo.statusCode).toBe(401);

    // Webhook firmado → APROBADO, stock descontado, reservas consumidas.
    const firma = firmarWebhook({ dataId: '5001', xRequestId: 'req-1', secret: MP_SECRET });
    const ok = await app.inject({
      method: 'POST',
      url: '/checkout/mercadopago/webhook?data.id=5001&type=payment',
      headers: { 'x-signature': firma, 'x-request-id': 'req-1' },
      payload: { type: 'payment', action: 'payment.updated', data: { id: '5001' } },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ ok: true, pedido: 'VD-10001', estado: 'APROBADO', repetido: false });

    let p = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id }, include: { pagos: true, reservas: true } });
    expect(p.estadoPago).toBe('APROBADO');
    // Prompt 5: al aprobarse el pago se asigna automáticamente a la óptica más cercana (a <1 km).
    expect(p.estado).toBe('ASIGNADO');
    expect(p.opticaId).toBe(ids.optica);
    expect(p.asignadoEn).not.toBeNull();
    expect(p.stockDescontado).toBe(true);
    expect(p.pagadoEn).not.toBeNull();
    expect(p.pagos.filter((x) => x.externoId === '5001')).toHaveLength(1);
    expect(p.reservas.every((r) => r.estado === 'CONSUMIDA')).toBe(true);
    expect((await prisma.variante.findUniqueOrThrow({ where: { id: ids.solA } })).stock).toBe(1);
    expect((await prisma.variante.findUniqueOrThrow({ where: { id: ids.recetado } })).stock).toBe(4);
    expect((await prisma.producto.findFirstOrThrow({ where: { slug: 'sol-a' } })).vendidos).toBe(2);

    // Mismo webhook repetido (y otro request-id): no duplica pagos ni descuenta de nuevo.
    for (const reqId of ['req-1', 'req-2']) {
      const rep = await app.inject({
        method: 'POST',
        url: '/checkout/mercadopago/webhook?data.id=5001&type=payment',
        headers: { 'x-signature': firmarWebhook({ dataId: '5001', xRequestId: reqId, secret: MP_SECRET }), 'x-request-id': reqId },
        payload: { type: 'payment', action: 'payment.updated', data: { id: '5001' } },
      });
      expect(rep.statusCode).toBe(200);
      expect(rep.json().repetido).toBe(true);
    }
    p = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id }, include: { pagos: true, reservas: true } });
    expect(p.pagos.filter((x) => x.externoId === '5001')).toHaveLength(1);
    expect((await prisma.variante.findUniqueOrThrow({ where: { id: ids.solA } })).stock).toBe(1);
    expect(await prisma.pedido.count()).toBe(1);
    expect(await prisma.eventoWebhook.count()).toBe(2);

    // Pantalla de gracias: detalle público accesible por id.
    const det = await app.inject({ method: 'GET', url: `/checkout/pedidos/${pedido.id}`, cookies: clienteCookie });
    expect(det.statusCode).toBe(200);
    expect(det.json().estadoPago).toBe('APROBADO');
    const ajeno = await app.inject({ method: 'GET', url: `/checkout/pedidos/${pedido.id}` });
    expect(ajeno.statusCode).toBe(403);
    const porEmail = await app.inject({ method: 'GET', url: `/checkout/pedidos/${pedido.id}?email=${datos.email}` });
    expect(porEmail.statusCode).toBe(200);

    // Uso del cupón registrado: el mismo cliente no puede usarlo de nuevo (usosMaxPorCliente = 1).
    const otra = await app.inject({
      method: 'POST',
      url: '/checkout/cotizar',
      payload: { items: [{ varianteId: ids.solB, cantidad: 1 }], cupon: 'DIEZ', email: datos.email },
    });
    expect(otra.json().cuponError).toMatch(/máximo de veces/);
  });

  it('la reserva vencida se libera y el stock vuelve a estar disponible', async () => {
    stubMP();
    const res = await app.inject({
      method: 'POST',
      url: '/checkout/pedidos',
      payload: {
        datos: { ...datos, email: 'otro@test.vedere' },
        entrega: { modalidad: 'RETIRO_OPTICA', opticaId: ids.optica, direccion },
        pago: { metodo: 'MERCADO_PAGO' },
        items: [{ varianteId: ids.solB, cantidad: 2 }],
      },
    });
    expect(res.statusCode).toBe(201);
    const pedidoId = res.json().pedido.id as string;
    const bloqueado = await app.inject({
      method: 'POST',
      url: '/checkout/cotizar',
      payload: { items: [{ varianteId: ids.solB, cantidad: 1 }] },
    });
    expect(bloqueado.json().sinStock).toEqual([{ varianteId: ids.solB, disponible: 0 }]);

    // Vence la reserva (simulamos el paso de 30 minutos).
    await prisma.reservaStock.updateMany({ where: { pedidoId }, data: { expiraEn: new Date(Date.now() - 1000) } });
    const libre = await app.inject({
      method: 'POST',
      url: '/checkout/cotizar',
      payload: { items: [{ varianteId: ids.solB, cantidad: 2 }] },
    });
    expect(libre.json().sinStock).toEqual([]);
    const reservas = await prisma.reservaStock.findMany({ where: { pedidoId } });
    expect(reservas.every((r) => r.estado === 'LIBERADA')).toBe(true);
    await prisma.pedido.update({ where: { id: pedidoId }, data: { estado: 'CANCELADO' } });
  });

  it('compra por transferencia queda pendiente, acepta comprobante y el admin la aprueba (una sola vez)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/checkout/pedidos',
      payload: {
        datos: { ...datos, email: 'transfer@test.vedere' },
        entrega: { modalidad: 'RETIRO_OPTICA', opticaId: ids.optica, direccion },
        pago: { metodo: 'TRANSFERENCIA' },
        items: [{ varianteId: ids.solB, cantidad: 1 }],
      },
    });
    expect(res.statusCode).toBe(201);
    const { pedido, initPoint } = res.json();
    expect(initPoint).toBeNull();
    expect(pedido.estado).toBe('PENDIENTE_PAGO');
    expect(pedido.metodoPago).toBe('TRANSFERENCIA');
    // 10 % de descuento por transferencia.
    expect(pedido.totales).toMatchObject({ subtotal: 60000, descuentos: 6000, total: 54000 });
    expect(pedido.totales.detalle[0].tipo).toBe('TRANSFERENCIA');

    // Comprobante (PDF) subido por el cliente.
    const boundary = 'xxBOUNDARYxx';
    const cuerpo = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="comprobante.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      Buffer.from('%PDF-1.4 test'),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const comp = await app.inject({
      method: 'POST',
      url: `/checkout/pedidos/${pedido.id}/comprobante`,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: cuerpo,
    });
    expect(comp.statusCode).toBe(200);
    expect(comp.json().comprobanteUrl).toMatch(/comprobantes\/.+\.pdf$/);

    // Admin: aparece en la lista como pendiente y lo aprueba.
    const lista = await app.inject({ method: 'GET', url: '/admin/pedidos?estadoPago=PENDIENTE', cookies: staffCookie });
    expect(lista.statusCode).toBe(200);
    expect(lista.json().items.some((p: { id: string }) => p.id === pedido.id)).toBe(true);

    const stockAntes = (await prisma.variante.findUniqueOrThrow({ where: { id: ids.solB } })).stock;
    const ap = await app.inject({ method: 'POST', url: `/admin/pedidos/${pedido.id}/pago/aprobar`, cookies: staffCookie, payload: { nota: 'Vi la transferencia' } });
    expect(ap.statusCode).toBe(200);
    expect(ap.json().estadoPago).toBe('APROBADO');
    expect(ap.json().yaEstaba).toBe(false);
    expect((await prisma.variante.findUniqueOrThrow({ where: { id: ids.solB } })).stock).toBe(stockAntes - 1);

    const ap2 = await app.inject({ method: 'POST', url: `/admin/pedidos/${pedido.id}/pago/aprobar`, cookies: staffCookie });
    expect(ap2.json().yaEstaba).toBe(true);
    expect((await prisma.variante.findUniqueOrThrow({ where: { id: ids.solB } })).stock).toBe(stockAntes - 1);

    // Factura (PUT) y estado (POST /estado, forzado porque la óptica todavía no aceptó).
    const upd = await app.inject({
      method: 'PUT',
      url: `/admin/pedidos/${pedido.id}`,
      cookies: staffCookie,
      payload: { numeroFactura: 'A-0001-00001234' },
    });
    expect(upd.json()).toMatchObject({ numeroFactura: 'A-0001-00001234', estado: 'ASIGNADO' });
    const est = await app.inject({
      method: 'POST',
      url: `/admin/pedidos/${pedido.id}/estado`,
      cookies: staffCookie,
      payload: { estado: 'EN_ARMADO', forzar: true, nota: 'test' },
    });
    expect(est.json()).toMatchObject({ estado: 'EN_ARMADO' });

    // Cancelar repone stock.
    const can = await app.inject({ method: 'POST', url: `/admin/pedidos/${pedido.id}/cancelar`, cookies: staffCookie, payload: { motivo: 'test' } });
    expect(can.json().estado).toBe('CANCELADO');
    expect((await prisma.variante.findUniqueOrThrow({ where: { id: ids.solB } })).stock).toBe(stockAntes);
  });

  it('rechaza Mercado Pago cuando está apagado por configuración', async () => {
    await prisma.configTienda.update({ where: { id: 'default' }, data: { mpHabilitado: false } });
    const res = await app.inject({
      method: 'POST',
      url: '/checkout/pedidos',
      payload: {
        datos,
        entrega: { modalidad: 'RETIRO_OPTICA', opticaId: ids.optica, direccion },
        pago: { metodo: 'MERCADO_PAGO' },
        items: [{ varianteId: ids.solB, cantidad: 1 }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details[0].path).toBe('pago.metodo');
    await prisma.configTienda.update({ where: { id: 'default' }, data: { mpHabilitado: true } });
  });

  it('admin: ABM de promociones, creadores (con reporte) y configuración', async () => {
    const promo = await app.inject({
      method: 'POST',
      url: '/admin/promociones',
      cookies: staffCookie,
      payload: { nombre: 'Segundo 50 Verano', tipo: 'SEGUNDO_50', coleccionId: ids.coleccion, activa: false },
    });
    expect(promo.statusCode).toBe(201);
    expect(promo.json().coleccion.slug).toBe('verano');
    const lista = await app.inject({ method: 'GET', url: '/admin/promociones', cookies: staffCookie });
    expect(lista.json().items.length).toBe(3);
    const del = await app.inject({ method: 'DELETE', url: `/admin/promociones/${promo.json().id}`, cookies: staffCookie });
    expect(del.statusCode).toBe(204);

    const creador = await app.inject({
      method: 'POST',
      url: '/admin/creadores',
      cookies: staffCookie,
      payload: { nombre: 'Lu Fashion', instagram: '@lufashion', comision: 10 },
    });
    expect(creador.statusCode).toBe(201);
    expect(creador.json().slug).toBe('lu-fashion');
    const cup = await app.inject({
      method: 'POST',
      url: '/admin/cupones',
      cookies: staffCookie,
      payload: { codigo: 'LU15', tipo: 'PORCENTAJE', valor: 15, creadorId: creador.json().id, coleccionIds: [ids.coleccion] },
    });
    expect(cup.statusCode).toBe(201);
    expect(cup.json().creador.nombre).toBe('Lu Fashion');
    expect(cup.json().colecciones[0].slug).toBe('verano');

    // Venta con el código → reporte.
    const venta = await app.inject({
      method: 'POST',
      url: '/checkout/pedidos',
      payload: {
        datos: { ...datos, email: 'fan@test.vedere' },
        entrega: { modalidad: 'RETIRO_OPTICA', opticaId: ids.optica, direccion },
        pago: { metodo: 'TRANSFERENCIA' },
        items: [{ varianteId: ids.recetado, cantidad: 1 }],
        receta: { modo: 'OPTICA' },
        cupon: 'LU15',
      },
    });
    expect(venta.statusCode).toBe(201);
    const antes = await app.inject({ method: 'GET', url: `/admin/creadores/${creador.json().id}/reporte`, cookies: staffCookie });
    expect(antes.json().codigos).toEqual([]); // aún no aprobado
    await app.inject({ method: 'POST', url: `/admin/pedidos/${venta.json().pedido.id}/pago/aprobar`, cookies: staffCookie });
    const rep = await app.inject({ method: 'GET', url: '/admin/creadores/reporte', cookies: staffCookie });
    expect(rep.json().codigos).toHaveLength(1);
    // 120.000 − 15 % cupón (18.000) = 102.000 − 10 % transferencia (10.200) = 91.800
    expect(rep.json().codigos[0]).toMatchObject({ codigo: 'LU15', pedidos: 1, ventas: 91800, descuentos: 18000, comision: 9180 });

    const cfg = await app.inject({
      method: 'PUT',
      url: '/admin/config-tienda',
      cookies: staffCookie,
      payload: { descuentoTransferencia: 5, cuotasPorLinea: { MULTIFOCAL: 12, SOL: 3 }, alias: 'vedere.mp' },
    });
    expect(cfg.statusCode).toBe(200);
    expect(cfg.json()).toMatchObject({ descuentoTransferencia: 5, alias: 'vedere.mp', cuotasPorLinea: { SOL: 3 } });
    const cfgCliente = await app.inject({ method: 'PUT', url: '/admin/config-tienda', cookies: clienteCookie, payload: { alias: 'x' } });
    expect(cfgCliente.statusCode).toBe(403);
  });
});
