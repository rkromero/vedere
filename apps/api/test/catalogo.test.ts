// Tests de integración del catálogo contra una base real (TEST_DATABASE_URL).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@vedere/db';
import { testEnv } from './helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!hasDb)('catálogo (integración)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let adminCookie: Record<string, string>;
  let operadorCookie: Record<string, string>;
  let clienteCookie: Record<string, string>;

  const ids = { marca: '', catPadre: '', catHija: '', coleccion: '', producto: '', slug: '' };

  beforeAll(async () => {
    const db = await import('@vedere/db');
    prisma = db.prisma;
    const { buildApp } = await import('../src/app.js');
    app = await buildApp({
      env: testEnv({ DATABASE_URL: process.env.TEST_DATABASE_URL!, STORAGE_DRIVER: 'local' }),
      logger: false,
    });
    await app.ready();

    // Base limpia
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE imagenes_variante, variantes, "_CategoriaToProducto", productos, categorias, marcas, colecciones, refresh_tokens, users RESTART IDENTITY CASCADE',
    );

    const mk = async (email: string, rol: 'ADMIN' | 'OPERADOR' | 'CLIENTE') =>
      prisma.user.create({ data: { email, nombre: rol, rol, passwordHash: 'x' } });
    const admin = await mk('admin@test.vedere', 'ADMIN');
    const operador = await mk('operador@test.vedere', 'OPERADOR');
    const cliente = await mk('cliente@test.vedere', 'CLIENTE');

    const cookie = (u: { id: string; email: string; rol: 'ADMIN' | 'OPERADOR' | 'CLIENTE' }) => ({
      vedere_access: app.jwt.sign({ sub: u.id, email: u.email, rol: u.rol }),
    });
    adminCookie = cookie(admin);
    operadorCookie = cookie(operador);
    clienteCookie = cookie(cliente);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const post = (url: string, payload: unknown, cookies = adminCookie) =>
    app.inject({ method: 'POST', url, payload, cookies });
  const put = (url: string, payload: unknown, cookies = adminCookie) =>
    app.inject({ method: 'PUT', url, payload, cookies });
  const get = (url: string, cookies?: Record<string, string>) =>
    app.inject({ method: 'GET', url, cookies });

  it('crea marca, categoría hija, colección y producto con 3 variantes e imágenes; aparece en el endpoint público', async () => {
    const marca = await post('/admin/marcas', { nombre: 'Vedere Test' });
    expect(marca.statusCode).toBe(201);
    ids.marca = marca.json().id;
    expect(marca.json().slug).toBe('vedere-test');

    const padre = await post('/admin/categorias', { nombre: 'Sol', orden: 1 });
    expect(padre.statusCode).toBe(201);
    ids.catPadre = padre.json().id;

    const hija = await post('/admin/categorias', { nombre: 'Polarizados', padreId: ids.catPadre });
    expect(hija.statusCode).toBe(201);
    expect(hija.json().padreId).toBe(ids.catPadre);
    ids.catHija = hija.json().id;

    const col = await post('/admin/colecciones', { nombre: 'Sol', colorHex: '#F2B33D' });
    expect(col.statusCode).toBe(201);
    ids.coleccion = col.json().id;

    const imagenes = (sku: string) => [
      { url: `https://img.test/${sku}-frente.webp`, tipo: 'FRENTE', orden: 0 },
      { url: `https://img.test/${sku}-perfil.webp`, tipo: 'PERFIL', orden: 1 },
    ];
    const producto = await post('/admin/productos', {
      nombre: 'Aviador Test',
      descripcion: 'Aviador de prueba',
      marcaId: ids.marca,
      categoriaIds: [ids.catPadre, ids.catHija],
      coleccionId: ids.coleccion,
      linea: 'SOL',
      material: 'METAL',
      forma: 'AVIADOR',
      genero: 'UNISEX',
      calibreMm: 58,
      puenteMm: 14,
      varillaMm: 140,
      precio: 89900,
      precioLista: 99900,
      permiteReceta: true,
      estado: 'PUBLICADO',
      variantes: [
        {
          colorArmazon: 'Dorado',
          colorArmazonHex: '#C9A24D',
          sku: 'TST-AV-DOR',
          stock: 5,
          stockMinimo: 2,
          imagenes: imagenes('dor'),
        },
        {
          colorArmazon: 'Negro',
          colorArmazonHex: '#0A0A0A',
          sku: 'TST-AV-NEG',
          stock: 3,
          stockMinimo: 2,
          imagenes: imagenes('neg'),
        },
        {
          colorArmazon: 'Plateado',
          colorArmazonHex: '#BFC3C7',
          sku: 'TST-AV-PLA',
          stock: 1,
          stockMinimo: 2,
          imagenes: imagenes('pla'),
        },
      ],
    });
    expect(producto.statusCode).toBe(201);
    const body = producto.json();
    ids.producto = body.id;
    ids.slug = body.slug;
    expect(body.variantes).toHaveLength(3);
    expect(body.variantes[0].imagenes).toHaveLength(2);
    expect(body.categorias.map((c: { id: string }) => c.id).sort()).toEqual(
      [ids.catPadre, ids.catHija].sort(),
    );
    expect(body.createdById).toBeTruthy();
    expect(body.variantes[2].bajoStock).toBe(true);

    const publico = await get(`/catalogo/productos/${ids.slug}`);
    expect(publico.statusCode).toBe(200);
    expect(publico.json().variantes).toHaveLength(3);
    expect(publico.json().marca.slug).toBe('vedere-test');
    expect(publico.json()).not.toHaveProperty('createdById');

    // Filtro por categoría hija (slug) y por categoría padre (incluye descendientes)
    const porHija = await get('/catalogo/productos?categoria=polarizados');
    expect(porHija.json().total).toBe(1);
    const porPadre = await get(
      '/catalogo/productos?categoria=sol&linea=SOL&forma=AVIADOR&color=dor',
    );
    expect(porPadre.json().total).toBe(1);
    const sinMatch = await get('/catalogo/productos?material=ACETATO');
    expect(sinMatch.json().total).toBe(0);
  });

  it('un SKU duplicado devuelve 409 con mensaje claro y no se guarda', async () => {
    const antes = await prisma.variante.count();
    const res = await post(`/admin/productos/${ids.producto}/variantes`, {
      colorArmazon: 'Rojo',
      sku: 'tst-av-dor', // se normaliza a mayúsculas → duplicado
      stock: 1,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('DUPLICATE');
    expect(res.json().error.message).toMatch(/SKU/);
    expect(await prisma.variante.count()).toBe(antes);

    // También al crear un producto nuevo con un SKU existente: no se crea nada
    const productosAntes = await prisma.producto.count();
    const res2 = await post('/admin/productos', {
      nombre: 'Otro',
      linea: 'SOL',
      precio: 1000,
      variantes: [{ colorArmazon: 'Negro', sku: 'TST-AV-NEG' }],
    });
    expect(res2.statusCode).toBe(409);
    expect(await prisma.producto.count()).toBe(productosAntes);
  });

  it('actualiza el producto (categorías, precio) y valida referencias', async () => {
    const res = await put(`/admin/productos/${ids.producto}`, {
      precio: 79900,
      categoriaIds: [ids.catHija],
      destacado: true,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().precio).toBe(79900);
    expect(res.json().categorias).toHaveLength(1);

    const bad = await put(`/admin/productos/${ids.producto}`, { marcaId: 'no-existe' });
    expect(bad.statusCode).toBe(400);

    const invalido = await post('/admin/productos', { nombre: 'X', linea: 'OTRA', precio: -1 });
    expect(invalido.statusCode).toBe(400);
    expect(invalido.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('un PUT parcial no pisa los campos que no se envían (categorías, estado, variantes)', async () => {
    const antesRes = await get(`/admin/productos/${ids.producto}`, adminCookie);
    expect(antesRes.statusCode, antesRes.body).toBe(200);
    const antes = antesRes.json();
    expect(antes.categorias.length).toBeGreaterThan(0);
    const res = await put(`/admin/productos/${ids.producto}`, { precio: antes.precio + 1 });
    expect(res.statusCode).toBe(200);
    const despues = res.json();
    expect(despues.precio).toBe(antes.precio + 1);
    expect(despues.estado).toBe(antes.estado);
    expect(despues.destacado).toBe(antes.destacado);
    expect(despues.permiteReceta).toBe(antes.permiteReceta);
    expect(despues.categorias.map((c: { id: string }) => c.id).sort()).toEqual(
      antes.categorias.map((c: { id: string }) => c.id).sort(),
    );
    expect(despues.variantes.length).toBe(antes.variantes.length);

    // Variante: cambiar sólo el stock conserva imágenes y activa.
    const v = antes.variantes[0];
    const vres = await put(`/admin/variantes/${v.id}`, { stock: v.stock + 5 });
    expect(vres.statusCode).toBe(200);
    expect(vres.json().imagenes.length).toBe(v.imagenes.length);
    expect(vres.json().activa).toBe(v.activa);
    expect(vres.json().stockMinimo).toBe(v.stockMinimo);

    // Marca inactiva + PUT sólo nombre → sigue inactiva.
    const m = await post('/admin/marcas', { nombre: 'Inactiva', activa: false });
    const mres = await put(`/admin/marcas/${m.json().id}`, { nombre: 'Inactiva 2' });
    expect(mres.json()).toMatchObject({ nombre: 'Inactiva 2', activa: false });
  });

  it('archivar un producto lo saca del endpoint público sin borrarlo', async () => {
    const bulk = await post('/admin/productos/bulk', { ids: [ids.producto], accion: 'archivar' });
    expect(bulk.statusCode).toBe(200);
    expect(bulk.json().afectados).toBe(1);

    const publico = await get(`/catalogo/productos/${ids.slug}`);
    expect(publico.statusCode).toBe(404);
    const lista = await get('/catalogo/productos');
    expect(lista.json().total).toBe(0);

    const admin = await get(`/admin/productos/${ids.producto}`, adminCookie);
    expect(admin.statusCode).toBe(200);
    expect(admin.json().estado).toBe('ARCHIVADO');
    expect(admin.json().variantes).toHaveLength(3);

    // Volver a publicar
    const rep = await post('/admin/productos/bulk', { ids: [ids.producto], accion: 'publicar' });
    expect(rep.json().afectados).toBe(1);
    expect((await get(`/catalogo/productos/${ids.slug}`)).statusCode).toBe(200);
  });

  it('OPERADOR gestiona el catálogo pero no usuarios; CLIENTE no accede al admin', async () => {
    const marca = await post('/admin/marcas', { nombre: 'Marca Operador' }, operadorCookie);
    expect(marca.statusCode).toBe(201);
    const lista = await get('/admin/productos', operadorCookie);
    expect(lista.statusCode).toBe(200);

    // El OPERADOR crea, edita, publica, archiva y borra productos.
    const creadoOp = await post(
      '/admin/productos',
      {
        nombre: 'Producto del Operador',
        linea: 'SOL',
        precio: 1000,
        marcaId: marca.json().id,
        categoriaIds: [ids.catHija],
        variantes: [{ colorArmazon: 'Negro', sku: 'OPE-001', stock: 3 }],
      },
      operadorCookie,
    );
    expect(creadoOp.statusCode).toBe(201);
    expect(creadoOp.json().createdById).toBeTruthy();
    const opId = creadoOp.json().id as string;
    const editado = await put(
      `/admin/productos/${opId}`,
      { precio: 1500, destacado: true },
      operadorCookie,
    );
    expect(editado.statusCode).toBe(200);
    expect(editado.json()).toMatchObject({ precio: 1500, destacado: true });
    const variante = await post(
      `/admin/productos/${opId}/variantes`,
      { colorArmazon: 'Carey', sku: 'OPE-002', stock: 1 },
      operadorCookie,
    );
    expect(variante.statusCode).toBe(201);
    const publicar = await post(
      '/admin/productos/bulk',
      { ids: [opId], accion: 'publicar' },
      operadorCookie,
    );
    expect(publicar.statusCode).toBe(200);
    expect((await get('/catalogo/productos/producto-del-operador')).statusCode).toBe(200);
    const archivar = await post(
      '/admin/productos/bulk',
      { ids: [opId], accion: 'archivar' },
      operadorCookie,
    );
    expect(archivar.statusCode).toBe(200);
    expect((await get('/catalogo/productos/producto-del-operador')).statusCode).toBe(404);
    const borrar = await app.inject({
      method: 'DELETE',
      url: `/admin/productos/${opId}`,
      cookies: operadorCookie,
    });
    expect(borrar.statusCode).toBe(204);
    const dash = await get('/admin/dashboard', operadorCookie);
    expect(dash.statusCode).toBe(200);
    expect(dash.json().variantesBajoStock.length).toBeGreaterThan(0);

    const usuarios = await get('/admin/usuarios', operadorCookie);
    expect(usuarios.statusCode).toBe(403);
    const crearUsuario = await post(
      '/admin/usuarios',
      { email: 'x@x.com', nombre: 'X', password: 'password123' },
      operadorCookie,
    );
    expect(crearUsuario.statusCode).toBe(403);

    expect((await get('/admin/productos', clienteCookie)).statusCode).toBe(403);
    expect((await post('/admin/marcas', { nombre: 'Nope' }, clienteCookie)).statusCode).toBe(403);
    expect((await get('/admin/productos')).statusCode).toBe(401);

    // ADMIN sí gestiona usuarios
    const creado = await post('/admin/usuarios', {
      email: 'nuevo@test.vedere',
      nombre: 'Nuevo Operador',
      rol: 'OPERADOR',
      password: 'password123',
    });
    expect(creado.statusCode).toBe(201);
    const cambio = await put(`/admin/usuarios/${creado.json().id}`, {
      rol: 'OPTICA',
      activo: false,
    });
    expect(cambio.statusCode).toBe(200);
    expect(cambio.json()).toMatchObject({ rol: 'OPTICA', activo: false });
    const reset = await post(`/admin/usuarios/${creado.json().id}/password`, {
      password: 'otraclave123',
    });
    expect(reset.statusCode).toBe(200);
  });

  it('el CSV exportado se vuelve a importar sin errores', async () => {
    const exp = await get('/admin/productos/export.csv', adminCookie);
    expect(exp.statusCode).toBe(200);
    expect(exp.headers['content-type']).toMatch(/text\/csv/);
    const csv = exp.body;
    expect(csv).toContain('producto_slug');
    expect(csv).toContain('TST-AV-DOR');

    const antes = {
      productos: await prisma.producto.count(),
      variantes: await prisma.variante.count(),
    };
    const imp = await app.inject({
      method: 'POST',
      url: '/admin/productos/import',
      headers: { 'content-type': 'text/csv' },
      payload: csv,
      cookies: adminCookie,
    });
    expect(imp.statusCode).toBe(200);
    expect(imp.json()).toMatchObject({
      productosCreados: 0,
      productosActualizados: antes.productos,
      variantesCreadas: 0,
      variantesActualizadas: antes.variantes,
    });
    expect(await prisma.producto.count()).toBe(antes.productos);
    expect(await prisma.variante.count()).toBe(antes.variantes);

    // Importar un producto nuevo (fila agregada) y rechazar un CSV con SKU repetido
    const nuevo =
      csv.trimEnd() +
      '\n' +
      csv
        .split('\n')[1]!
        .replace('aviador-test', 'aviador-nuevo')
        .replace('TST-AV-DOR', 'TST-NEW-1');
    const imp2 = await app.inject({
      method: 'POST',
      url: '/admin/productos/import',
      headers: { 'content-type': 'text/csv' },
      payload: nuevo,
      cookies: adminCookie,
    });
    expect(imp2.statusCode).toBe(200);
    expect(imp2.json().productosCreados).toBe(1);

    const malo =
      csv.trimEnd() + '\n' + csv.split('\n')[1]!.replace('aviador-test', 'otro-producto');
    const imp3 = await app.inject({
      method: 'POST',
      url: '/admin/productos/import',
      headers: { 'content-type': 'text/csv' },
      payload: malo,
      cookies: adminCookie,
    });
    expect(imp3.statusCode).toBe(400);
    expect(imp3.json().error.details.errores[0].mensaje).toMatch(/SKU/);
  });

  it('listado público: orden por precio y filtro por rango', async () => {
    await post('/admin/productos', {
      nombre: 'Barato',
      linea: 'ACCESORIO',
      precio: 1000,
      estado: 'PUBLICADO',
    });
    await post('/admin/productos', {
      nombre: 'Caro',
      linea: 'ACCESORIO',
      precio: 500000,
      estado: 'PUBLICADO',
    });
    const asc = await get('/catalogo/productos?orden=precio_asc');
    const precios = asc.json().items.map((p: { precio: number }) => p.precio);
    expect(precios).toEqual([...precios].sort((a, b) => a - b));
    const rango = await get('/catalogo/productos?precioMin=2000&precioMax=100000');
    expect(
      rango.json().items.every((p: { precio: number }) => p.precio >= 2000 && p.precio <= 100000),
    ).toBe(true);
    const filtros = await get('/catalogo/filtros');
    expect(filtros.statusCode).toBe(200);
    expect(filtros.json().precio.min).toBe(1000);
  });

  it('elimina un producto (cascada a variantes e imágenes)', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: `/admin/productos/${ids.producto}`,
      cookies: adminCookie,
    });
    expect(del.statusCode).toBe(204);
    expect((await get(`/admin/productos/${ids.producto}`, adminCookie)).statusCode).toBe(404);
    expect(await prisma.variante.count({ where: { productoId: ids.producto } })).toBe(0);
  });
});
