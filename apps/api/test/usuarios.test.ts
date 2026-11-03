// ABM de usuarios (sólo ADMIN): crear, editar, cambiar rol, resetear contraseña, desactivar y
// activar, con sus efectos sobre el login y las sesiones. Integración contra TEST_DATABASE_URL.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@vedere/db';
import { testEnv } from './helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!hasDb)('usuarios (integración)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let adminId = '';
  let adminCookie: Record<string, string>;
  let operadorCookie: Record<string, string>;
  let nuevoId = '';

  beforeAll(async () => {
    const db = await import('@vedere/db');
    prisma = db.prisma;
    const { buildApp } = await import('../src/app.js');
    app = await buildApp({
      env: testEnv({ DATABASE_URL: process.env.TEST_DATABASE_URL!, STORAGE_DRIVER: 'local' }),
      logger: false,
    });
    await app.ready();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE refresh_tokens, users RESTART IDENTITY CASCADE');

    const admin = await prisma.user.create({
      data: { email: 'root@test.vedere', nombre: 'Root', rol: 'ADMIN', passwordHash: 'x' },
    });
    const operador = await prisma.user.create({
      data: { email: 'op@test.vedere', nombre: 'Op', rol: 'OPERADOR', passwordHash: 'x' },
    });
    adminId = admin.id;
    adminCookie = {
      vedere_access: app.jwt.sign({ sub: admin.id, email: admin.email, rol: 'ADMIN' }),
    };
    operadorCookie = {
      vedere_access: app.jwt.sign({ sub: operador.id, email: operador.email, rol: 'OPERADOR' }),
    };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const post = (url: string, payload?: unknown, cookies = adminCookie) =>
    app.inject({ method: 'POST', url, payload, cookies });
  const put = (url: string, payload: unknown, cookies = adminCookie) =>
    app.inject({ method: 'PUT', url, payload, cookies });
  const get = (url: string, cookies = adminCookie) => app.inject({ method: 'GET', url, cookies });
  const login = (email: string, password: string) =>
    app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });

  it('crea un usuario con contraseña hasheada y lo lista con filtros', async () => {
    const res = await post('/admin/usuarios', {
      email: '  Nueva@Test.Vedere ',
      nombre: 'Nueva Operadora',
      telefono: '+54 11 5555-5555',
      rol: 'OPERADOR',
      password: 'clave-inicial-123',
    });
    expect(res.statusCode).toBe(201);
    const u = res.json();
    nuevoId = u.id;
    expect(u).toMatchObject({ email: 'nueva@test.vedere', rol: 'OPERADOR', activo: true });
    expect(u.passwordHash).toBeUndefined();
    const enDb = await prisma.user.findUniqueOrThrow({ where: { id: nuevoId } });
    expect(enDb.passwordHash).toMatch(/^\$argon2id\$/);

    // Puede loguearse con la contraseña inicial.
    expect((await login('nueva@test.vedere', 'clave-inicial-123')).statusCode).toBe(200);

    const porRol = await get('/admin/usuarios?rol=OPERADOR');
    expect(
      porRol
        .json()
        .items.map((x: { email: string }) => x.email)
        .sort(),
    ).toEqual(['nueva@test.vedere', 'op@test.vedere']);
    const porTexto = await get('/admin/usuarios?q=nueva');
    expect(porTexto.json().total).toBe(1);
    const detalle = await get(`/admin/usuarios/${nuevoId}`);
    expect(detalle.json().telefono).toBe('+54 11 5555-5555');
  });

  it('rechaza email duplicado y contraseñas cortas con errores claros', async () => {
    const dup = await post('/admin/usuarios', {
      email: 'nueva@test.vedere',
      nombre: 'Otra',
      password: 'clave-inicial-123',
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('DUPLICATE');

    const corta = await post('/admin/usuarios', {
      email: 'corta@test.vedere',
      nombre: 'Corta',
      password: '123',
    });
    expect(corta.statusCode).toBe(400);
    expect(corta.json().error.details?.password ?? corta.json().error.message).toBeTruthy();
  });

  it('edita nombre y teléfono, y cambia el rol cerrando las sesiones', async () => {
    const edit = await put(`/admin/usuarios/${nuevoId}`, {
      nombre: 'Nueva Editada',
      telefono: null,
    });
    expect(edit.statusCode).toBe(200);
    expect(edit.json()).toMatchObject({ nombre: 'Nueva Editada', telefono: null, rol: 'OPERADOR' });

    // Sesión abierta → cambiar rol la revoca.
    const sesion = await login('nueva@test.vedere', 'clave-inicial-123');
    expect(sesion.statusCode).toBe(200);
    const refreshAntes = await prisma.refreshToken.count({
      where: { userId: nuevoId, revokedAt: null },
    });
    expect(refreshAntes).toBeGreaterThanOrEqual(1);

    const optica = await prisma.optica.upsert({
      where: { slug: 'optica-usuarios' },
      update: {},
      create: { nombre: 'Óptica Usuarios', slug: 'optica-usuarios', direccion: 'Calle 1', localidad: 'CABA', provincia: 'Buenos Aires', codigoPostal: '1425' },
    });
    const rol = await put(`/admin/usuarios/${nuevoId}`, { rol: 'OPTICA', opticaId: optica.id });
    expect(rol.statusCode).toBe(200);
    expect(rol.json()).toMatchObject({ rol: 'OPTICA', opticaId: optica.id });
    const refreshDespues = await prisma.refreshToken.count({
      where: { userId: nuevoId, revokedAt: null },
    });
    expect(refreshDespues).toBe(0);

    // Con rol OPTICA ya no entra al backoffice.
    const cookieOptica = {
      vedere_access: app.jwt.sign({ sub: nuevoId, email: 'nueva@test.vedere', rol: 'OPTICA' }),
    };
    expect((await get('/admin/productos', cookieOptica)).statusCode).toBe(403);
    expect((await put(`/admin/usuarios/${nuevoId}`, { rol: 'OPERADOR' })).statusCode).toBe(200);
  });

  it('resetea la contraseña: la vieja deja de servir y la nueva funciona', async () => {
    const reset = await post(`/admin/usuarios/${nuevoId}/password`, {
      password: 'clave-nueva-456',
    });
    expect(reset.statusCode).toBe(200);
    expect((await login('nueva@test.vedere', 'clave-inicial-123')).statusCode).toBe(401);
    expect((await login('nueva@test.vedere', 'clave-nueva-456')).statusCode).toBe(200);
    expect(
      (await post(`/admin/usuarios/${nuevoId}/password`, { password: 'corta' })).statusCode,
    ).toBe(400);
  });

  it('desactiva (baja lógica): no puede loguearse ni refrescar; activar lo restituye', async () => {
    const sesion = await login('nueva@test.vedere', 'clave-nueva-456');
    const refreshCookie = sesion.cookies.find((c) => c.name === 'vedere_refresh')!.value;

    const off = await post(`/admin/usuarios/${nuevoId}/desactivar`);
    expect(off.statusCode).toBe(200);
    expect(off.json().activo).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: nuevoId } })).activo).toBe(false);

    expect((await login('nueva@test.vedere', 'clave-nueva-456')).statusCode).toBe(401);
    const refresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { vedere_refresh: refreshCookie },
    });
    expect(refresh.statusCode).toBe(401);

    const inactivos = await get('/admin/usuarios?activo=false');
    expect(inactivos.json().items.map((x: { id: string }) => x.id)).toContain(nuevoId);

    const on = await post(`/admin/usuarios/${nuevoId}/activar`);
    expect(on.statusCode).toBe(200);
    expect(on.json().activo).toBe(true);
    expect((await login('nueva@test.vedere', 'clave-nueva-456')).statusCode).toBe(200);
  });

  it('el ADMIN no puede desactivarse ni quitarse el rol a sí mismo', async () => {
    expect((await post(`/admin/usuarios/${adminId}/desactivar`)).statusCode).toBe(400);
    expect((await put(`/admin/usuarios/${adminId}`, { activo: false })).statusCode).toBe(400);
    expect((await put(`/admin/usuarios/${adminId}`, { rol: 'OPERADOR' })).statusCode).toBe(400);
    expect((await put(`/admin/usuarios/${adminId}`, { nombre: 'Root Editado' })).statusCode).toBe(
      200,
    );
  });

  it('OPERADOR no accede a ninguna ruta de usuarios; id inexistente da 404', async () => {
    for (const [method, url, payload] of [
      ['GET', '/admin/usuarios', undefined],
      ['GET', `/admin/usuarios/${nuevoId}`, undefined],
      ['POST', '/admin/usuarios', { email: 'z@z.com', nombre: 'Z', password: 'password123' }],
      ['PUT', `/admin/usuarios/${nuevoId}`, { nombre: 'Hack' }],
      ['POST', `/admin/usuarios/${nuevoId}/password`, { password: 'password123' }],
      ['POST', `/admin/usuarios/${nuevoId}/desactivar`, undefined],
      ['POST', `/admin/usuarios/${nuevoId}/activar`, undefined],
    ] as const) {
      const res = await app.inject({ method, url, payload, cookies: operadorCookie });
      expect(res.statusCode, `${method} ${url}`).toBe(403);
    }
    expect((await get('/admin/usuarios/no-existe')).statusCode).toBe(404);
    expect((await put('/admin/usuarios/no-existe', { nombre: 'Nadie' })).statusCode).toBe(404);
  });
});
