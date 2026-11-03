// Tests de integración de la tienda pública (prompt 3) contra una base real (TEST_DATABASE_URL):
// promos, ópticas, cupones, newsletter, avisos de stock, contacto, sugerencias y carrito sincronizado.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@vedere/db';
import { testEnv } from './helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!hasDb)('tienda pública (integración)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let staffCookie: Record<string, string>;
  let clienteCookie: Record<string, string>;
  const ids = { producto: '', varianteSinStock: '', varianteConStock: '', promo: '', optica: '' };

  beforeAll(async () => {
    const db = await import('@vedere/db');
    prisma = db.prisma;
    const { buildApp } = await import('../src/app.js');
    app = await buildApp({
      env: testEnv({ DATABASE_URL: process.env.TEST_DATABASE_URL!, STORAGE_DRIVER: 'local' }),
      logger: false,
    });
    await app.ready();

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE avisos_stock, carritos, mensajes_contacto, suscripciones_newsletter, cupones, opticas, promo_mensajes, imagenes_variante, variantes, "_CategoriaToProducto", productos, categorias, marcas, colecciones, refresh_tokens, users RESTART IDENTITY CASCADE',
    );

    const admin = await prisma.user.create({
      data: { email: 'admin@tienda.vedere', nombre: 'Admin', rol: 'ADMIN', passwordHash: 'x' },
    });
    const cliente = await prisma.user.create({
      data: { email: 'cli@tienda.vedere', nombre: 'Cli', rol: 'CLIENTE', passwordHash: 'x' },
    });
    staffCookie = {
      vedere_access: app.jwt.sign({ sub: admin.id, email: admin.email, rol: 'ADMIN' }),
    };
    clienteCookie = {
      vedere_access: app.jwt.sign({ sub: cliente.id, email: cliente.email, rol: 'CLIENTE' }),
    };

    const col = await prisma.coleccion.create({
      data: { nombre: 'Sol', slug: 'sol', colorHex: '#F2B33D' },
    });
    const p = await prisma.producto.create({
      data: {
        nombre: 'Aviador Costa',
        slug: 'aviador-costa',
        linea: 'SOL',
        forma: 'AVIADOR',
        material: 'METAL',
        precio: 89900,
        precioLista: 109900,
        estado: 'PUBLICADO',
        publicadoEn: new Date(),
        edicionLimitada: true,
        coleccionId: col.id,
        variantes: {
          create: [
            { sku: 'T-AV-DOR', colorArmazon: 'Dorado', colorArmazonHex: '#C9A24D', stock: 5 },
            { sku: 'T-AV-NEG', colorArmazon: 'Negro', colorArmazonHex: '#0A0A0A', stock: 0 },
          ],
        },
      },
      include: { variantes: true },
    });
    ids.producto = p.id;
    ids.varianteConStock = p.variantes.find((v) => v.sku === 'T-AV-DOR')!.id;
    ids.varianteSinStock = p.variantes.find((v) => v.sku === 'T-AV-NEG')!.id;
    await prisma.producto.create({
      data: {
        nombre: 'Redondo Palermo',
        slug: 'redondo-palermo',
        linea: 'SOL',
        forma: 'REDONDO',
        material: 'ACETATO',
        precio: 64900,
        estado: 'PUBLICADO',
        publicadoEn: new Date('2020-01-01'),
        coleccionId: col.id,
        variantes: { create: [{ sku: 'T-RP-CAR', colorArmazon: 'Carey', stock: 3 }] },
      },
    });
    await prisma.producto.create({
      data: {
        nombre: 'Borrador oculto',
        slug: 'borrador-oculto',
        linea: 'SOL',
        precio: 1,
        estado: 'BORRADOR',
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const get = (url: string, cookies?: Record<string, string>) =>
    app.inject({ method: 'GET', url, cookies });
  const post = (url: string, payload: unknown, cookies?: Record<string, string>) =>
    app.inject({ method: 'POST', url, payload, cookies });
  const put = (url: string, payload: unknown, cookies?: Record<string, string>) =>
    app.inject({ method: 'PUT', url, payload, cookies });

  it('catálogo: filtros por lista (forma, color) y flags nuevo / edición limitada', async () => {
    const todos = await get('/catalogo/productos');
    expect(todos.statusCode).toBe(200);
    expect(todos.json().total).toBe(2); // el borrador no aparece
    const aviador = todos.json().items.find((p: { slug: string }) => p.slug === 'aviador-costa');
    expect(aviador.nuevo).toBe(true);
    expect(aviador.edicionLimitada).toBe(true);
    const redondo = todos.json().items.find((p: { slug: string }) => p.slug === 'redondo-palermo');
    expect(redondo.nuevo).toBe(false);

    const porForma = await get('/catalogo/productos?forma=AVIADOR,CUADRADO');
    expect(porForma.json().total).toBe(1);
    expect(porForma.json().items[0].slug).toBe('aviador-costa');

    const porColor = await get('/catalogo/productos?color=carey,azul');
    expect(porColor.json().total).toBe(1);
    expect(porColor.json().items[0].slug).toBe('redondo-palermo');

    const porSlugs = await get('/catalogo/productos?slugs=redondo-palermo,no-existe');
    expect(porSlugs.json().total).toBe(1);

    const invalido = await get('/catalogo/productos?forma=TRIANGULO');
    expect(invalido.statusCode).toBe(400);
  });

  it('relacionados y sugerencias', async () => {
    const rel = await get('/catalogo/productos/aviador-costa/relacionados');
    expect(rel.statusCode).toBe(200);
    expect(rel.json().items.map((p: { slug: string }) => p.slug)).toEqual(['redondo-palermo']);

    const sug = await get('/catalogo/sugerencias?q=avi');
    expect(sug.statusCode).toBe(200);
    expect(sug.json().productos).toHaveLength(1);
    expect(sug.json().productos[0]).toMatchObject({ slug: 'aviador-costa', precio: 89900 });

    const porColor = await get('/catalogo/sugerencias?q=carey');
    expect(porColor.json().productos[0].slug).toBe('redondo-palermo');

    const corto = await get('/catalogo/sugerencias?q=');
    expect(corto.statusCode).toBe(400);
  });

  it('colecciones públicas incluyen cantidad de productos y portada', async () => {
    const res = await get('/catalogo/colecciones');
    expect(res.statusCode).toBe(200);
    expect(res.json().items[0]).toMatchObject({ slug: 'sol', productos: 2 });
  });

  it('promos: el staff las administra y la tienda sólo ve las activas y vigentes', async () => {
    const anon = await post('/admin/promos', { texto: 'x' });
    expect(anon.statusCode).toBe(401);

    const creada = await post(
      '/admin/promos',
      { texto: 'Envío gratis desde $80.000', link: '/envios', orden: 1 },
      staffCookie,
    );
    expect(creada.statusCode).toBe(201);
    ids.promo = creada.json().id;

    const inactiva = await post(
      '/admin/promos',
      { texto: 'Promo apagada', activo: false },
      staffCookie,
    );
    expect(inactiva.statusCode).toBe(201);

    const vencida = await post(
      '/admin/promos',
      { texto: 'Promo vencida', vigenciaHasta: '2020-01-01T00:00:00.000Z' },
      staffCookie,
    );
    expect(vencida.statusCode).toBe(201);

    const invertida = await post(
      '/admin/promos',
      { texto: 'Mal', vigenciaDesde: '2030-01-01', vigenciaHasta: '2020-01-01' },
      staffCookie,
    );
    expect(invertida.statusCode).toBe(400);

    const publicas = await get('/catalogo/promos');
    expect(publicas.statusCode).toBe(200);
    expect(publicas.json().items).toHaveLength(1);
    expect(publicas.json().items[0]).toMatchObject({ texto: 'Envío gratis desde $80.000' });

    const editada = await put(`/admin/promos/${ids.promo}`, { texto: 'Editada' }, staffCookie);
    expect(editada.statusCode).toBe(200);
    expect(editada.json().link).toBe('/envios'); // PUT parcial no pisa
  });

  it('ópticas: ABM del staff y buscador público por código postal y por cercanía', async () => {
    const mk = (o: Record<string, unknown>) => post('/admin/opticas', o, staffCookie);
    const palermo = await mk({
      nombre: 'Óptica Palermo',
      direccion: 'Santa Fe 4120',
      localidad: 'Palermo',
      provincia: 'Buenos Aires',
      codigoPostal: 'C1425ABC',
      lat: -34.5846,
      lng: -58.4216,
    });
    expect(palermo.statusCode).toBe(201);
    expect(palermo.json().slug).toBe('optica-palermo-palermo');
    expect(palermo.json().codigoPostal).toBe('C1425ABC');
    ids.optica = palermo.json().id;
    const rosario = await mk({
      nombre: 'Óptica Rosario',
      direccion: 'Córdoba 1450',
      localidad: 'Rosario',
      provincia: 'Santa Fe',
      codigoPostal: '2000',
      lat: -32.9468,
      lng: -60.6393,
    });
    expect(rosario.statusCode).toBe(201);
    const inactiva = await mk({
      nombre: 'Cerrada',
      direccion: 'Calle 123',
      localidad: 'Centro',
      provincia: 'Buenos Aires',
      codigoPostal: '1000',
      activa: false,
    });
    expect(inactiva.statusCode).toBe(201);

    const cpInvalido = await mk({
      nombre: 'Mal CP',
      direccion: 'Calle 123',
      localidad: 'Centro',
      provincia: 'Buenos Aires',
      codigoPostal: '12',
    });
    expect(cpInvalido.statusCode).toBe(400);

    const porCp = await get('/catalogo/opticas?cp=2100');
    expect(porCp.statusCode).toBe(200);
    expect(porCp.json().total).toBe(2); // la inactiva no aparece
    expect(porCp.json().items[0].nombre).toBe('Óptica Rosario');
    expect(porCp.json().items[0]).not.toHaveProperty('createdById');

    const porGps = await get('/catalogo/opticas?lat=-34.6&lng=-58.4');
    expect(porGps.json().items[0].nombre).toBe('Óptica Palermo');
    expect(porGps.json().items[0].distanciaKm).toBeLessThan(5);

    const porTexto = await get('/catalogo/opticas?q=rosario');
    expect(porTexto.json().total).toBe(1);

    const editada = await put(`/admin/opticas/${ids.optica}`, { horarios: 'Lun a vie' }, staffCookie);
    expect(editada.statusCode).toBe(200);
    expect(editada.json().lat).toBeCloseTo(-34.5846);
  });

  it('cupones: alta y validación con mínimo, vigencia y usos', async () => {
    const porcentaje = await post(
      '/admin/cupones',
      { codigo: 'bienvenida10', tipo: 'PORCENTAJE', valor: 10 },
      staffCookie,
    );
    expect(porcentaje.statusCode).toBe(201);
    expect(porcentaje.json().codigo).toBe('BIENVENIDA10');

    const demasiado = await post(
      '/admin/cupones',
      { codigo: 'MAL', tipo: 'PORCENTAJE', valor: 150 },
      staffCookie,
    );
    expect(demasiado.statusCode).toBe(400);

    const monto = await post(
      '/admin/cupones',
      { codigo: 'VEDERE5000', tipo: 'MONTO', valor: 5000, minimoCompra: 60000 },
      staffCookie,
    );
    expect(monto.statusCode).toBe(201);
    await post(
      '/admin/cupones',
      { codigo: 'VENCIDO', tipo: 'MONTO', valor: 1, vigenciaHasta: '2020-01-01' },
      staffCookie,
    );
    await post(
      '/admin/cupones',
      { codigo: 'AGOTADO', tipo: 'MONTO', valor: 1, usosMax: 1 },
      staffCookie,
    );
    await prisma.cupon.update({ where: { codigo: 'AGOTADO' }, data: { usos: 1 } });

    const ok = await post('/catalogo/cupones/validar', { codigo: 'bienvenida10', subtotal: 100000 });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ valido: true, descuento: 10000 });

    const bajoMinimo = await post('/catalogo/cupones/validar', {
      codigo: 'VEDERE5000',
      subtotal: 30000,
    });
    expect(bajoMinimo.statusCode).toBe(400);
    expect(bajoMinimo.json().error.message).toContain('60.000');

    const sobreMinimo = await post('/catalogo/cupones/validar', {
      codigo: 'VEDERE5000',
      subtotal: 70000,
    });
    expect(sobreMinimo.json().descuento).toBe(5000);

    expect((await post('/catalogo/cupones/validar', { codigo: 'VENCIDO' })).statusCode).toBe(400);
    expect((await post('/catalogo/cupones/validar', { codigo: 'AGOTADO' })).statusCode).toBe(400);
    expect((await post('/catalogo/cupones/validar', { codigo: 'NOEXISTE' })).statusCode).toBe(404);
  });

  it('newsletter, avisos de stock y contacto quedan en la bandeja del staff', async () => {
    const news = await post('/catalogo/newsletter', { email: 'Ana@Mail.com' });
    expect(news.statusCode).toBe(201);
    const repetido = await post('/catalogo/newsletter', { email: 'ana@mail.com' });
    expect(repetido.statusCode).toBe(201);
    const malEmail = await post('/catalogo/newsletter', { email: 'no-es-email' });
    expect(malEmail.statusCode).toBe(400);

    const aviso = await post('/catalogo/avisos-stock', {
      email: 'ana@mail.com',
      varianteId: ids.varianteSinStock,
    });
    expect(aviso.statusCode).toBe(201);
    const avisoInexistente = await post('/catalogo/avisos-stock', {
      email: 'ana@mail.com',
      varianteId: 'nope',
    });
    expect(avisoInexistente.statusCode).toBe(404);

    const contacto = await post('/catalogo/contacto', {
      nombre: 'Ana',
      email: 'ana@mail.com',
      motivo: 'TURNO',
      mensaje: 'Quiero un turno para multifocales',
    });
    expect(contacto.statusCode).toBe(201);
    const spam = await post('/catalogo/contacto', {
      nombre: 'Bot',
      email: 'bot@mail.com',
      mensaje: 'compra ya',
      web: 'http://spam',
    });
    expect(spam.statusCode).toBe(201);

    const bandeja = await get('/admin/contacto', staffCookie);
    expect(bandeja.statusCode).toBe(200);
    expect(bandeja.json().total).toBe(1); // el spam no se guarda
    expect(bandeja.json().sinLeer).toBe(1);
    const id = bandeja.json().items[0].id;
    const leido = await put(`/admin/contacto/${id}/leido`, {}, staffCookie);
    expect(leido.json().leidoEn).not.toBeNull();

    const avisos = await get('/admin/avisos-stock', staffCookie);
    expect(avisos.json().total).toBe(1);
    expect(avisos.json().items[0].variante.producto.slug).toBe('aviador-costa');

    const suscriptos = await get('/admin/newsletter', staffCookie);
    expect(suscriptos.json().total).toBe(1);
    expect(suscriptos.json().items[0].email).toBe('ana@mail.com');

    const anon = await get('/admin/newsletter');
    expect(anon.statusCode).toBe(401);
    const cliente = await get('/admin/newsletter', clienteCookie);
    expect(cliente.statusCode).toBe(403);
  });

  it('carrito sincronizado: requiere sesión y persiste el snapshot', async () => {
    const anon = await get('/carrito');
    expect(anon.statusCode).toBe(401);

    const vacio = await get('/carrito', clienteCookie);
    expect(vacio.statusCode).toBe(200);
    expect(vacio.json().items).toEqual([]);

    const guardado = await put(
      '/carrito',
      {
        items: [{ varianteId: ids.varianteConStock, cantidad: 2, nombre: 'Aviador', precio: 1 }],
        cupon: 'BIENVENIDA10',
      },
      clienteCookie,
    );
    expect(guardado.statusCode).toBe(200);
    expect(guardado.json().items[0]).toMatchObject({ cantidad: 2, nombre: 'Aviador' });

    const leido = await get('/carrito', clienteCookie);
    expect(leido.json().cupon).toBe('BIENVENIDA10');

    const invalido = await put('/carrito', { items: [{ varianteId: 'x', cantidad: 0 }] }, clienteCookie);
    expect(invalido.statusCode).toBe(400);
  });
});
