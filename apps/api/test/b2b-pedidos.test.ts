// Tests del prompt B2B 2: precio por óptica (descuento), catálogo mayorista, compra mínima, carrito del
// portal separado del de la tienda, pedidos VM-xxxxx, "repetir pedido" con ajuste por stock, aislamiento
// entre ópticas (403) y aprobación que reserva stock con la lógica existente.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { evaluarMinimo, precioParaOptica } from '../src/lib/mayorista.js';
import { crearContexto } from './prompt6-helpers.js';
import type { Contexto, Cookies } from './prompt6-helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;

describe('precio por óptica y compra mínima (unitario)', () => {
  it('aplica el descuento de la óptica sobre el precio mayorista y suma IVA aparte', () => {
    const p = { precioMayorista: 100000, precio: 242000 };
    expect(precioParaOptica(p, 10, 21)).toMatchObject({ lista: 100000, unitario: 90000, iva: 18900, conIva: 108900, sugerido: 242000 });
    expect(precioParaOptica(p, 0, 21)).toMatchObject({ unitario: 100000, iva: 21000, conIva: 121000 });
    // Margen: venta sin IVA 200.000 − costo 100.000 = 100.000 → 50%.
    expect(precioParaOptica(p, 0, 21)).toMatchObject({ ganancia: 100000, margenPct: 50 });
    expect(precioParaOptica({ precioMayorista: null, precio: 1 }, 0, 21)).toBeNull();
  });
  it('dice cuánto falta para la compra mínima', () => {
    const u = evaluarMinimo({ tipo: 'UNIDADES', valor: 6, propio: false }, 5, 0);
    expect(u).toMatchObject({ cumple: false, falta: 1 });
    expect(u.mensaje).toMatch(/falta 1 unidad/);
    expect(evaluarMinimo({ tipo: 'UNIDADES', valor: 6, propio: false }, 6, 0).cumple).toBe(true);
    const m = evaluarMinimo({ tipo: 'MONTO', valor: 500000, propio: true }, 3, 420000);
    expect(m).toMatchObject({ cumple: false, falta: 80000 });
    expect(evaluarMinimo({ tipo: 'NINGUNO', valor: 0, propio: false }, 0, 0).cumple).toBe(true);
  });
});

describe.skipIf(!hasDb)('B2B 2: catálogo y pedidos mayoristas (integración)', () => {
  let ctx: Contexto;
  let opticaA = '';
  let opticaB = '';
  let cookieA: Cookies;
  let cookieA2: Cookies;
  let cookieB: Cookies;
  let usuarioA = '';
  let v1 = ''; // Aviador Oro (stock 10)
  let v2 = ''; // Aviador Plata (stock 4)
  let vRec = ''; // Recetado de la tienda con precio mayorista
  let pedidoA = '';

  const get = (url: string, c?: Cookies) => ctx.inject('GET', url, c);
  const put = (url: string, c: Cookies, body: unknown) => ctx.inject('PUT', url, c, body);
  const post = (url: string, c: Cookies, body?: unknown) => ctx.inject('POST', url, c, body ?? {});

  async function usuarioOptica(opticaId: string, email: string, dueno = true) {
    const u = await ctx.prisma.user.create({
      data: { email, nombre: `Usuario ${email}`, rol: 'OPTICA', opticaId, opticaDueno: dueno, passwordHash: 'x' },
    });
    return { id: u.id, cookie: { vedere_access: ctx.app.jwt.sign({ sub: u.id, email, rol: 'OPTICA', nombre: u.nombre, opticaId }) } };
  }

  beforeAll(async () => {
    ctx = await crearContexto();
    const { prisma } = ctx;
    opticaA = ctx.ids.optica;
    await prisma.optica.update({ where: { id: opticaA }, data: { descuentoPct: 10 } });
    const b = await prisma.optica.create({
      data: { nombre: 'Óptica Norte', slug: 'optica-norte', direccion: 'Cabildo 2000', localidad: 'Belgrano', provincia: 'Buenos Aires', codigoPostal: '1428' },
    });
    opticaB = b.id;
    const ua = await usuarioOptica(opticaA, 'duena@centro.test');
    usuarioA = ua.id;
    cookieA = ua.cookie;
    cookieA2 = (await usuarioOptica(opticaA, 'equipo@centro.test', false)).cookie;
    cookieB = (await usuarioOptica(opticaB, 'dueno@norte.test')).cookie;

    const marca = await prisma.marca.findFirstOrThrow();
    const cat = await prisma.categoria.create({ data: { nombre: 'Sol', slug: 'sol' } });
    const avi = await prisma.producto.create({
      data: {
        nombre: 'Aviador Mayorista',
        slug: 'aviador-mayorista',
        linea: 'SOL',
        forma: 'AVIADOR',
        precio: 242000,
        precioMayorista: 100000,
        estado: 'PUBLICADO',
        publicadoEn: new Date(),
        calibreMm: 58,
        puenteMm: 14,
        varillaMm: 140,
        marcaId: marca.id,
        coleccionId: ctx.ids.coleccion,
        categorias: { connect: [{ id: cat.id }] },
        variantes: {
          create: [
            { sku: 'VM-AVI-ORO', colorArmazon: 'Oro', stock: 10, orden: 0 },
            { sku: 'VM-AVI-PLA', colorArmazon: 'Plata', stock: 4, orden: 1 },
          ],
        },
      },
      include: { variantes: { orderBy: { orden: 'asc' } } },
    });
    v1 = avi.variantes[0]!.id;
    v2 = avi.variantes[1]!.id;
    // Recetado de la tienda: con precio mayorista entra al canal.
    await prisma.producto.update({ where: { id: ctx.ids.productoRecetado }, data: { precioMayorista: 50000 } });
    vRec = ctx.ids.recetado;
    // Sol A (sin precio mayorista) no aparece. Un producto oculto para ópticas tampoco.
    await prisma.producto.create({
      data: {
        nombre: 'Sólo Web',
        slug: 'solo-web',
        linea: 'SOL',
        precio: 80000,
        precioMayorista: 30000,
        visibleMayorista: false,
        estado: 'PUBLICADO',
        publicadoEn: new Date(),
        variantes: { create: [{ sku: 'VM-SOLO-WEB', colorArmazon: 'Negro', stock: 3 }] },
      },
    });
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('el portal exige una sesión de óptica', async () => {
    expect((await get('/optica/mayorista/productos')).statusCode).toBe(401);
    expect((await get('/optica/mayorista/productos', ctx.clienteCookie)).statusCode).toBe(403);
    expect((await get('/optica/mayorista/productos', ctx.staffCookie)).statusCode).toBe(403);
  });

  it('cada óptica ve el precio con SU descuento: 10% → $90.000 + IVA; 0% → $100.000 + IVA', async () => {
    const a = await get('/optica/mayorista/productos/aviador-mayorista', cookieA);
    expect(a.statusCode).toBe(200);
    expect(a.json().precio).toMatchObject({ lista: 100000, descuentoPct: 10, unitario: 90000, iva: 18900, conIva: 108900, ivaPct: 21, sugerido: 242000 });
    const b = await get('/optica/mayorista/productos/aviador-mayorista', cookieB);
    expect(b.json().precio).toMatchObject({ lista: 100000, descuentoPct: 0, unitario: 100000, iva: 21000, conIva: 121000 });
    // El descuento no se puede pedir por parámetro ni se filtra el de otra óptica.
    const trucho = await get(`/optica/mayorista/productos/aviador-mayorista?opticaId=${opticaA}&descuentoPct=50`, cookieB);
    expect(trucho.json().precio.unitario).toBe(100000);
    expect(JSON.stringify(b.json())).not.toContain('90000');
  });

  it('el IVA es configurable', async () => {
    await ctx.prisma.configMayorista.upsert({ where: { id: 'default' }, create: { id: 'default', ivaPct: 10.5 }, update: { ivaPct: 10.5 } });
    const b = await get('/optica/mayorista/productos/aviador-mayorista', cookieB);
    expect(b.json().precio).toMatchObject({ unitario: 100000, iva: 10500, ivaPct: 10.5 });
    await ctx.prisma.configMayorista.update({ where: { id: 'default' }, data: { ivaPct: 21 } });
  });

  it('catálogo: sólo publicados, visibles para ópticas y con precio mayorista; filtros, SKU y stock por variante', async () => {
    const r = await get('/optica/mayorista/productos?pageSize=50', cookieA);
    const slugs = r.json().items.map((p: { slug: string }) => p.slug).sort();
    expect(slugs).toEqual(['aviador-mayorista', 'recetado-r']);
    const avi = r.json().items.find((p: { slug: string }) => p.slug === 'aviador-mayorista');
    expect(avi.variantes.map((v: { sku: string; disponible: number }) => [v.sku, v.disponible])).toEqual([
      ['VM-AVI-ORO', 10],
      ['VM-AVI-PLA', 4],
    ]);
    // Nunca expone datos internos.
    expect(JSON.stringify(r.json())).not.toMatch(/precioMayorista|stockMinimo|comisionPct/);

    const porSku = await get('/optica/mayorista/productos?q=VM-AVI-PLA', cookieA);
    expect(porSku.json().items.map((p: { slug: string }) => p.slug)).toEqual(['aviador-mayorista']);
    const porLinea = await get('/optica/mayorista/productos?linea=RECETADO', cookieA);
    expect(porLinea.json().items.map((p: { slug: string }) => p.slug)).toEqual(['recetado-r']);
    const porForma = await get('/optica/mayorista/productos?forma=AVIADOR&categoria=sol&marca=vedere-lab&coleccion=verano&color=Plata', cookieA);
    expect(porForma.json().items.map((p: { slug: string }) => p.slug)).toEqual(['aviador-mayorista']);
    expect((await get('/optica/mayorista/productos/solo-web', cookieA)).statusCode).toBe(404);
    expect((await get('/optica/mayorista/productos/sol-a', cookieA)).statusCode).toBe(404);

    const f = await get('/optica/mayorista/filtros', cookieA);
    expect(f.json().marcas.map((m: { slug: string }) => m.slug)).toEqual(['vedere-lab']);
    expect(f.json().lineas.map((l: { valor: string }) => l.valor).sort()).toEqual(['RECETADO', 'SOL']);
  });

  it('ficha técnica en PDF y ZIP con fotos y ficha', async () => {
    const pdf = await get('/optica/mayorista/productos/aviador-mayorista/ficha.pdf', cookieA);
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
    const zip = await get('/optica/mayorista/productos/aviador-mayorista/kit.zip', cookieA);
    expect(zip.statusCode).toBe(200);
    expect(zip.headers['content-disposition']).toContain('aviador-mayorista-vedere.zip');
    expect(zip.rawPayload.subarray(0, 2).toString()).toBe('PK');
    expect(zip.rawPayload.includes(Buffer.from('aviador-mayorista-ficha-tecnica.pdf'))).toBe(true);
  });

  it('con compra mínima de 6 unidades, un pedido de 5 no se confirma y avisa que falta 1', async () => {
    await ctx.prisma.configMayorista.update({ where: { id: 'default' }, data: { minimoTipo: 'UNIDADES', minimoValor: 6 } });
    const c = await put('/optica/mayorista/carrito', cookieA, { items: [{ varianteId: v1, cantidad: 3 }, { varianteId: v2, cantidad: 2 }] });
    expect(c.statusCode).toBe(200);
    expect(c.json()).toMatchObject({ unidades: 5, minimo: { tipo: 'UNIDADES', valor: 6, cumple: false, falta: 1 } });
    const r = await post('/optica/mayorista/pedidos', cookieA, { entrega: 'RETIRO_DEPOSITO' });
    expect(r.statusCode).toBe(422);
    expect(r.json().error).toMatchObject({ code: 'MINIMO_NO_ALCANZADO' });
    expect(r.json().error.message).toMatch(/falta 1 unidad/);
    expect(await ctx.prisma.pedidoMayorista.count()).toBe(0);
  });

  it('la compra mínima puede ser distinta por óptica (por monto)', async () => {
    await ctx.prisma.optica.update({ where: { id: opticaB }, data: { minimoTipo: 'MONTO', minimoValor: 250000 } });
    const c = await put('/optica/mayorista/carrito', cookieB, { items: [{ varianteId: v1, cantidad: 2 }] });
    expect(c.json().minimo).toMatchObject({ tipo: 'MONTO', propio: true, cumple: false, falta: 50000 });
    const r = await post('/optica/mayorista/pedidos', cookieB, { entrega: 'RETIRO_DEPOSITO' });
    expect(r.statusCode).toBe(422);
    expect(r.json().error.message).toMatch(/faltan/);
  });

  it('confirma el pedido VM-10001 con precios congelados, descuento, IVA y envío; vacía el carrito', async () => {
    await ctx.prisma.configMayorista.update({
      where: { id: 'default' },
      data: { envioModo: 'COSTO_FIJO', envioCosto: 10000, retiroDireccion: 'Depósito Vedere, Av. Warnes 1200', retiroHorario: 'Lun a vie 9 a 17' },
    });
    const c = await put('/optica/mayorista/carrito', cookieA, { items: [{ varianteId: v1, cantidad: 1 }] });
    expect(c.json()).toMatchObject({ unidades: 6, minimo: { cumple: true } });
    expect(c.json().entrega.envio).toMatchObject({ modo: 'COSTO_FIJO', costo: 10000 });
    const r = await post('/optica/mayorista/pedidos', cookieA, { entrega: 'ENVIO_TRANSPORTE', notas: 'Entregar por la mañana' });
    expect(r.statusCode).toBe(201);
    const p = r.json();
    pedidoA = p.id;
    // 4 Oro + 2 Plata = 6 × 100.000 lista; −10% = 540.000; envío 10.000; IVA 21% sobre 550.000 = 115.500.
    expect(p).toMatchObject({
      numero: 'VM-10001',
      estado: 'PENDIENTE_APROBACION',
      entrega: 'ENVIO_TRANSPORTE',
      unidades: 6,
      subtotalLista: 600000,
      descuentoPct: 10,
      descuento: 60000,
      subtotal: 540000,
      envio: 10000,
      ivaPct: 21,
      iva: 115500,
      total: 665500,
      notas: 'Entregar por la mañana',
    });
    expect(p.direccionEntrega).toContain('Av. Rivadavia 4900');
    expect(p.items.find((i: { sku: string }) => i.sku === 'VM-AVI-ORO')).toMatchObject({ cantidad: 4, precioMayorista: 100000, precioUnitario: 90000, total: 360000, precioPublico: 242000 });
    expect((await get('/optica/mayorista/carrito', cookieA)).json().lineas).toEqual([]);
    // El precio queda congelado aunque cambie el catálogo.
    await ctx.prisma.producto.update({ where: { slug: 'aviador-mayorista' }, data: { precioMayorista: 150000 } });
    expect((await get(`/optica/mayorista/pedidos/${pedidoA}`, cookieA)).json().items[0].precioUnitario).toBe(90000);
    await ctx.prisma.producto.update({ where: { slug: 'aviador-mayorista' }, data: { precioMayorista: 100000 } });
  });

  it('el carrito de la tienda y el del portal no se mezclan', async () => {
    // Carrito de la tienda del mismo usuario de la óptica.
    expect((await put('/carrito', cookieA, { items: [{ varianteId: ctx.ids.solA, cantidad: 1 }] })).statusCode).toBe(200);
    const portal = await put('/optica/mayorista/carrito', cookieA, { items: [{ varianteId: vRec, cantidad: 2 }] });
    expect(portal.json().lineas.map((l: { varianteId: string }) => l.varianteId)).toEqual([vRec]);
    const tienda = await get('/carrito', cookieA);
    expect(tienda.json().items.map((i: { varianteId: string }) => i.varianteId)).toEqual([ctx.ids.solA]);
    expect(await ctx.prisma.carrito.findUnique({ where: { userId: usuarioA } })).toMatchObject({ items: [{ varianteId: ctx.ids.solA, cantidad: 1 }] });
    // Un producto que no es del canal no entra al carrito del portal.
    const fuera = await put('/optica/mayorista/carrito', cookieA, { items: [{ varianteId: ctx.ids.solA, cantidad: 1 }] });
    expect(fuera.json().ajustes).toEqual([expect.objectContaining({ varianteId: ctx.ids.solA, motivo: 'no_disponible' })]);
    expect(fuera.json().lineas.map((l: { varianteId: string }) => l.varianteId)).toEqual([vRec]);
    // Otro usuario de la misma óptica tiene su propio carrito.
    expect((await get('/optica/mayorista/carrito', cookieA2)).json().lineas).toEqual([]);
    await ctx.inject('DELETE', '/optica/mayorista/carrito', cookieA);
  });

  it('las cantidades del carrito se limitan al stock disponible', async () => {
    const r = await put('/optica/mayorista/carrito', cookieA, { items: [{ varianteId: v2, cantidad: 9 }], modo: 'reemplazar' });
    expect(r.json().ajustes).toEqual([expect.objectContaining({ sku: 'VM-AVI-PLA', motivo: 'ajustada', pedida: 9, disponible: 4 })]);
    expect(r.json().lineas[0]).toMatchObject({ varianteId: v2, cantidad: 4 });
    await ctx.inject('DELETE', '/optica/mayorista/carrito', cookieA);
  });

  it('una óptica no ve compras de otra: 403 por API (detalle y repetir) y no aparecen en su listado', async () => {
    expect((await get(`/optica/mayorista/pedidos/${pedidoA}`, cookieB)).statusCode).toBe(403);
    expect((await post(`/optica/mayorista/pedidos/${pedidoA}/repetir`, cookieB)).statusCode).toBe(403);
    expect((await get('/optica/mayorista/pedidos', cookieB)).json().total).toBe(0);
    // Los usuarios del equipo de la misma óptica sí la ven.
    expect((await get(`/optica/mayorista/pedidos/${pedidoA}`, cookieA2)).statusCode).toBe(200);
    expect((await get('/optica/mayorista/pedidos', cookieA2)).json().items.map((p: { numero: string }) => p.numero)).toEqual(['VM-10001']);
  });

  it('aprobar reserva stock (el mismo stock de la tienda) y despachar lo descuenta', async () => {
    const r = await post(`/admin/mayorista/pedidos/${pedidoA}/aprobar`, ctx.staffCookie);
    expect(r.statusCode).toBe(200);
    expect(r.json().estado).toBe('APROBADO');
    const reservas = await ctx.prisma.reservaStock.findMany({ where: { pedidoMayoristaId: pedidoA, estado: 'ACTIVA' } });
    expect(reservas.map((x) => [x.varianteId, x.cantidad]).sort()).toEqual([[v1, 4], [v2, 2]].sort());
    // La disponibilidad baja en el portal (y en la tienda, que usa la misma lógica de reservas).
    const avi = (await get('/optica/mayorista/productos/aviador-mayorista', cookieB)).json();
    expect(avi.variantes.map((v: { disponible: number }) => v.disponible)).toEqual([6, 2]);
    const { disponibilidad } = await import('../src/lib/reservas.js');
    const disp = await disponibilidad([{ id: v1, stock: 10 }], ctx.prisma, 'pedido-web-cualquiera');
    expect(disp.get(v1)).toBe(6);
    // No se aprueba dos veces.
    expect((await post(`/admin/mayorista/pedidos/${pedidoA}/aprobar`, ctx.staffCookie)).statusCode).toBe(409);

    const d = await post(`/admin/mayorista/pedidos/${pedidoA}/despachar`, ctx.staffCookie, { numeroSeguimiento: 'TR-123' });
    expect(d.json()).toMatchObject({ estado: 'DESPACHADO', numeroSeguimiento: 'TR-123' });
    const stocks = await ctx.prisma.variante.findMany({ where: { id: { in: [v1, v2] } }, orderBy: { orden: 'asc' } });
    expect(stocks.map((v) => v.stock)).toEqual([6, 2]);
    expect(await ctx.prisma.reservaStock.count({ where: { pedidoMayoristaId: pedidoA, estado: 'CONSUMIDA' } })).toBe(2);
    expect((await post(`/admin/mayorista/pedidos/${pedidoA}/entregar`, ctx.staffCookie)).json().estado).toBe('ENTREGADO');
  });

  it('no aprueba si el stock ya no alcanza', async () => {
    await put('/optica/mayorista/carrito', cookieB, { items: [{ varianteId: v1, cantidad: 3 }] });
    const p = await post('/optica/mayorista/pedidos', cookieB, { entrega: 'RETIRO_DEPOSITO' });
    expect(p.statusCode).toBe(201);
    expect(p.json().direccionEntrega).toContain('Av. Warnes 1200');
    await ctx.prisma.variante.update({ where: { id: v1 }, data: { stock: 1 } });
    const r = await post(`/admin/mayorista/pedidos/${p.json().id}/aprobar`, ctx.staffCookie);
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe('STOCK_INSUFICIENTE');
    const c = await post(`/admin/mayorista/pedidos/${p.json().id}/cancelar`, ctx.staffCookie, { motivo: 'Sin stock suficiente' });
    expect(c.json()).toMatchObject({ estado: 'CANCELADO', motivoCancelacion: 'Sin stock suficiente' });
    await ctx.prisma.variante.update({ where: { id: v1 }, data: { stock: 6 } });
  });

  it('"Repetir pedido" carga el carrito y avisa las variantes sin stock', async () => {
    await ctx.prisma.variante.update({ where: { id: v2 }, data: { stock: 0 } });
    const r = await post(`/optica/mayorista/pedidos/${pedidoA}/repetir`, cookieA);
    expect(r.statusCode).toBe(200);
    expect(r.json().repetidoDe).toMatchObject({ numero: 'VM-10001' });
    expect(r.json().lineas.map((l: { sku: string; cantidad: number }) => [l.sku, l.cantidad])).toEqual([['VM-AVI-ORO', 4]]);
    expect(r.json().ajustes).toEqual([expect.objectContaining({ sku: 'VM-AVI-PLA', motivo: 'sin_stock', pedida: 2, disponible: 0 })]);
    // Al confirmar queda registrado de qué pedido viene.
    await ctx.prisma.configMayorista.update({ where: { id: 'default' }, data: { minimoTipo: 'NINGUNO' } });
    const p = await post('/optica/mayorista/pedidos', cookieA, { entrega: 'RETIRO_DEPOSITO', repetidoDeId: pedidoA });
    expect(p.json()).toMatchObject({ numero: 'VM-10003', repetidoDeId: pedidoA, unidades: 4, envio: 0 });
  });

  it('admin: listado con resumen, configuración y descuento editable de la óptica', async () => {
    const l = await get('/admin/mayorista/pedidos', ctx.staffCookie);
    expect(l.json().total).toBe(3);
    expect(l.json().resumen).toMatchObject({ ENTREGADO: 1, CANCELADO: 1, PENDIENTE_APROBACION: 1 });
    expect((await get('/admin/mayorista/pedidos', ctx.clienteCookie)).statusCode).toBe(403);
    expect((await get('/admin/mayorista/pedidos', cookieA)).statusCode).toBe(403);

    const cfg = await put('/admin/mayorista/config', ctx.staffCookie, {
      ivaPct: 21,
      minimoTipo: 'MONTO',
      minimoValor: 300000,
      envioHabilitado: true,
      envioModo: 'A_CARGO_OPTICA',
      envioCosto: 0,
      retiroHabilitado: true,
      retiroDireccion: 'Av. Warnes 1200',
      retiroHorario: null,
    });
    expect(cfg.statusCode).toBe(200);
    expect(cfg.json()).toMatchObject({ minimoTipo: 'MONTO', minimoValor: 300000, envioModo: 'A_CARGO_OPTICA' });
    const mal = await put('/admin/mayorista/config', ctx.staffCookie, { ...cfg.json(), envioHabilitado: false, retiroHabilitado: false });
    expect(mal.statusCode).toBe(400);

    const o = await put(`/admin/opticas/${opticaB}`, ctx.staffCookie, { descuentoPct: 15, minimoTipo: null, minimoValor: null });
    expect(o.statusCode).toBe(200);
    expect(o.json()).toMatchObject({ descuentoPct: 15, minimoTipo: null });
    expect((await get('/optica/mayorista/productos/aviador-mayorista', cookieB)).json().precio.unitario).toBe(85000);
    expect((await get('/optica/mayorista/condiciones', cookieB)).json()).toMatchObject({ descuentoPct: 15, minimo: { tipo: 'MONTO', valor: 300000, propio: false } });
  });

  it('las condiciones de cada óptica no salen en los endpoints públicos de ópticas', async () => {
    const r = await get('/catalogo/opticas');
    expect(r.statusCode).toBe(200);
    expect(JSON.stringify(r.json())).not.toMatch(/descuentoPct|minimoValor|comisionPct|habilitacionUrl/);
    const una = await get('/catalogo/opticas/optica-centro');
    expect(JSON.stringify(una.json())).not.toMatch(/descuentoPct|comisionPct/);
  });
});
