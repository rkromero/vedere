// Tests de integración de la cuenta del cliente (prompt 6) contra TEST_DATABASE_URL: registro con referido y
// bienvenida, recuperación de contraseña, login con Google (fetch simulado), datos, direcciones, favoritos,
// recetas, pedidos y recompensa de referidos al aprobarse el primer pago.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@vedere/db';
import { testEnv } from './helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!hasDb)('cuenta del cliente (integración)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let staffCookie: Record<string, string>;
  const ids = { optica: '', sol: '', recetado: '', productoSol: '', productoBorrador: '' };
  const realFetch = globalThis.fetch;

  const cookieDe = (res: { cookies: Array<{ name: string; value: string }> }) =>
    Object.fromEntries(res.cookies.map((c) => [c.name, c.value]));

  async function registrar(email: string, nombre: string, ref?: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, nombre, password: 'contraseña-segura-1', ...(ref ? { ref } : {}) },
    });
    expect(res.statusCode).toBe(201);
    return { cookie: { vedere_access: cookieDe(res).vedere_access! }, user: res.json().user as { id: string; email: string } };
  }

  const direccion = {
    direccion: 'Av. Santa Fe 4100',
    localidad: 'Palermo',
    provincia: 'Buenos Aires',
    codigoPostal: '1425',
    lat: -34.585,
    lng: -58.42,
  };

  beforeAll(async () => {
    const db = await import('@vedere/db');
    prisma = db.prisma;
    const { buildApp } = await import('../src/app.js');
    app = await buildApp({
      env: testEnv({
        DATABASE_URL: process.env.TEST_DATABASE_URL!,
        STORAGE_DRIVER: 'local',
        GOOGLE_CLIENT_ID: 'google-client-id-test',
        GOOGLE_CLIENT_SECRET: 'google-client-secret-test',
      }),
      logger: false,
    });
    await app.ready();

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE password_resets, direcciones, favoritos, emails_enviados, plantillas_email, eventos_webhook, cupon_usos, reservas_stock, pagos, pedido_items, pedidos, recetas, promociones, creadores, config_tienda, avisos_stock, carritos, mensajes_contacto, suscripciones_newsletter, cupones, opticas, promo_mensajes, imagenes_variante, variantes, "_CategoriaToProducto", productos, categorias, marcas, colecciones, refresh_tokens, users RESTART IDENTITY CASCADE',
    );
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE pedidos_numero_seq RESTART WITH 20001`);

    const admin = await prisma.user.create({
      data: { email: 'admin@cuenta.vedere', nombre: 'Admin', rol: 'ADMIN', passwordHash: 'x' },
    });
    staffCookie = { vedere_access: app.jwt.sign({ sub: admin.id, email: admin.email, rol: 'ADMIN' }) };

    const optica = await prisma.optica.create({
      data: {
        nombre: 'Óptica Cuenta',
        slug: 'optica-cuenta',
        direccion: 'Calle 1',
        localidad: 'CABA',
        provincia: 'Buenos Aires',
        codigoPostal: '1425',
        lat: -34.58,
        lng: -58.42,
      },
    });
    ids.optica = optica.id;

    const crear = (nombre: string, slug: string, linea: 'SOL' | 'RECETADO', precio: number, sku: string, estado: 'PUBLICADO' | 'BORRADOR' = 'PUBLICADO') =>
      prisma.producto.create({
        data: {
          nombre,
          slug,
          linea,
          precio,
          estado,
          publicadoEn: estado === 'PUBLICADO' ? new Date() : null,
          permiteReceta: linea === 'RECETADO',
          variantes: { create: [{ sku, colorArmazon: 'Negro', stock: 10 }] },
        },
        include: { variantes: true },
      });
    const sol = await crear('Sol C', 'sol-c', 'SOL', 50000, 'CU-SOL');
    ids.sol = sol.variantes[0]!.id;
    ids.productoSol = sol.id;
    ids.recetado = (await crear('Recetado C', 'recetado-c', 'RECETADO', 100000, 'CU-REC')).variantes[0]!.id;
    ids.productoBorrador = (await crear('Borrador', 'borrador', 'SOL', 1000, 'CU-BOR', 'BORRADOR')).id;
    await prisma.configTienda.upsert({ where: { id: 'default' }, update: { referidoDescuentoPct: 12 }, create: { id: 'default', referidoDescuentoPct: 12 } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('registro: manda BIENVENIDA, acepta ref y expone el resumen de la cuenta', async () => {
    const ana = await registrar('ana@cuenta.vedere', 'Ana Pérez');
    const bienvenida = await prisma.emailEnviado.findFirst({ where: { para: 'ana@cuenta.vedere', tipo: 'BIENVENIDA' } });
    expect(bienvenida).not.toBeNull();
    expect(bienvenida!.asunto).toContain('Ana');

    // Código de referido generado a demanda.
    const ref = await app.inject({ method: 'GET', url: '/cuenta/referidos', cookies: ana.cookie });
    expect(ref.statusCode).toBe(200);
    expect(ref.json().codigo).toMatch(/^[A-Z0-9]{8}$/);
    expect(ref.json().link).toBe(`http://localhost:3000/r/${ref.json().codigo}`);
    expect(ref.json().descuentoPct).toBe(12);
    expect(ref.json().referidos).toEqual([]);

    // Un amigo se registra con el link (código en minúsculas: se normaliza).
    const beto = await registrar('beto@cuenta.vedere', 'Beto Gómez', ref.json().codigo.toLowerCase());
    const betoDb = await prisma.user.findUniqueOrThrow({ where: { id: beto.user.id } });
    expect(betoDb.referidoPorId).toBe(ana.user.id);

    const ref2 = await app.inject({ method: 'GET', url: '/cuenta/referidos', cookies: ana.cookie });
    expect(ref2.json().referidos).toEqual([expect.objectContaining({ nombre: 'Beto G.', estado: 'REGISTRADO' })]);

    // Código inexistente: se ignora (sin error).
    const carla = await registrar('carla@cuenta.vedere', 'Carla', 'ZZZZZZZZ');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: carla.user.id } })).referidoPorId).toBeNull();

    const resumen = await app.inject({ method: 'GET', url: '/cuenta', cookies: ana.cookie });
    expect(resumen.statusCode).toBe(200);
    expect(resumen.json().user).toMatchObject({ email: 'ana@cuenta.vedere', tienePassword: true, googleVinculado: false, newsletter: false });
    expect(resumen.json().resumen).toEqual({ pedidos: 0, recetas: 0, direcciones: 0, favoritos: 0 });
    expect(resumen.json().rivedere).toMatchObject({ ultimaCompraRecetado: null, proximoAviso: null, meses: 24, descuentoPct: 15 });

    // Sin sesión: 401.
    expect((await app.inject({ method: 'GET', url: '/cuenta' })).statusCode).toBe(401);
  });

  it('datos personales, newsletter y cambio de contraseña', async () => {
    const dana = await registrar('dana@cuenta.vedere', 'Dana');
    const put = await app.inject({
      method: 'PUT',
      url: '/cuenta/datos',
      cookies: dana.cookie,
      payload: { nombre: 'Dana López', telefono: '+54 11 4444-5555', newsletter: true },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().user).toMatchObject({ nombre: 'Dana López', telefono: '+54 11 4444-5555', newsletter: true });
    const sus = await prisma.suscripcionNewsletter.findUnique({ where: { email: 'dana@cuenta.vedere' } });
    expect(sus?.origen).toBe('cuenta');
    expect(sus?.bajaEn).toBeNull();

    const baja = await app.inject({ method: 'PUT', url: '/cuenta/datos', cookies: dana.cookie, payload: { nombre: 'Dana López', newsletter: false } });
    expect(baja.statusCode).toBe(200);
    expect((await prisma.suscripcionNewsletter.findUniqueOrThrow({ where: { email: 'dana@cuenta.vedere' } })).bajaEn).not.toBeNull();

    // Contraseña: la actual es obligatoria y debe coincidir.
    const sinActual = await app.inject({ method: 'PUT', url: '/cuenta/password', cookies: dana.cookie, payload: { nueva: 'otra-contraseña-2' } });
    expect(sinActual.statusCode).toBe(400);
    const mal = await app.inject({ method: 'PUT', url: '/cuenta/password', cookies: dana.cookie, payload: { actual: 'incorrecta', nueva: 'otra-contraseña-2' } });
    expect(mal.statusCode).toBe(400);
    const ok = await app.inject({ method: 'PUT', url: '/cuenta/password', cookies: dana.cookie, payload: { actual: 'contraseña-segura-1', nueva: 'otra-contraseña-2' } });
    expect(ok.statusCode).toBe(204);
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'dana@cuenta.vedere', password: 'otra-contraseña-2' } });
    expect(login.statusCode).toBe(200);
  });

  it('recuperar contraseña: token de un solo uso, vencimiento y cierre de sesiones', async () => {
    const eva = await registrar('eva@cuenta.vedere', 'Eva Ruiz');

    // Email inexistente: 204 igual, sin email.
    const nadie = await app.inject({ method: 'POST', url: '/auth/recuperar', payload: { email: 'nadie@cuenta.vedere' } });
    expect(nadie.statusCode).toBe(204);
    expect(await prisma.emailEnviado.count({ where: { para: 'nadie@cuenta.vedere' } })).toBe(0);

    const rec = await app.inject({ method: 'POST', url: '/auth/recuperar', payload: { email: 'EVA@cuenta.vedere' } });
    expect(rec.statusCode).toBe(204);
    const email = await prisma.emailEnviado.findFirst({ where: { para: 'eva@cuenta.vedere', tipo: 'RECUPERAR_PASSWORD' } });
    expect(email).not.toBeNull();
    const reset = await prisma.passwordReset.findFirstOrThrow({ where: { userId: eva.user.id, usadoEn: null } });
    expect(reset.expiresAt.getTime()).toBeGreaterThan(Date.now() + 50 * 60_000);

    // Token inválido.
    const malo = await app.inject({ method: 'POST', url: '/auth/restablecer', payload: { token: 'token-que-no-existe-xxxxxxxxxx', password: 'nueva-contraseña-3' } });
    expect(malo.statusCode).toBe(400);

    // El token real no se guarda: lo tomamos interceptando el hash. Pedimos uno nuevo y leemos el link del
    // email simulado no es posible (sólo se registra asunto), así que generamos el token a mano.
    const { createHash, randomBytes } = await import('node:crypto');
    const token = randomBytes(32).toString('base64url');
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { tokenHash: createHash('sha256').update(token).digest('hex') } });

    const ok = await app.inject({ method: 'POST', url: '/auth/restablecer', payload: { token, password: 'nueva-contraseña-3' } });
    expect(ok.statusCode).toBe(204);
    // Sesiones anteriores cerradas (refresh revocado).
    expect(await prisma.refreshToken.count({ where: { userId: eva.user.id, revokedAt: null } })).toBe(0);
    // Segundo uso: rechazado.
    const otra = await app.inject({ method: 'POST', url: '/auth/restablecer', payload: { token, password: 'nueva-contraseña-4' } });
    expect(otra.statusCode).toBe(400);

    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'eva@cuenta.vedere', password: 'contraseña-segura-1' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'eva@cuenta.vedere', password: 'nueva-contraseña-3' } })).statusCode).toBe(200);

    // Token vencido.
    const vencido = randomBytes(32).toString('base64url');
    await prisma.passwordReset.create({
      data: { userId: eva.user.id, tokenHash: createHash('sha256').update(vencido).digest('hex'), expiresAt: new Date(Date.now() - 1000) },
    });
    const exp = await app.inject({ method: 'POST', url: '/auth/restablecer', payload: { token: vencido, password: 'nueva-contraseña-5' } });
    expect(exp.statusCode).toBe(400);
  });

  it('login con Google: crea la cuenta, vincula una existente y rechaza state inválido', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === 'https://oauth2.googleapis.com/token') {
        const body = new URLSearchParams(String(init?.body));
        expect(body.get('redirect_uri')).toBe('http://localhost:3000/api/auth/google/callback');
        if (body.get('code') === 'code-malo') return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
        return new Response(JSON.stringify({ access_token: `at-${body.get('code')}` }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
        const at = new Headers(init?.headers).get('authorization') ?? '';
        const perfil = at.endsWith('code-gabi')
          ? { sub: 'g-123', email: 'Gabi@cuenta.vedere', email_verified: true, name: 'Gabi Sosa' }
          : at.endsWith('code-ana')
            ? { sub: 'g-ana', email: 'ana@cuenta.vedere', email_verified: true, name: 'Ana' }
            : { sub: 'g-nov', email: 'nov@cuenta.vedere', email_verified: false, name: 'No Verificado' };
        return new Response(JSON.stringify(perfil), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return realFetch(input, init);
    });

    // Inicio: redirige a Google con el state en cookie.
    const start = await app.inject({ method: 'GET', url: '/auth/google?next=/mi-cuenta/pedidos' });
    expect(start.statusCode).toBe(302);
    const location = new URL(start.headers.location as string);
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location.searchParams.get('client_id')).toBe('google-client-id-test');
    const state = location.searchParams.get('state')!;
    const stateCookie = cookieDe(start).vedere_oauth_state;
    expect(stateCookie).toBe(state);

    // State que no coincide con la cookie: vuelve a /ingresar con error.
    const csrf = await app.inject({ method: 'GET', url: `/auth/google/callback?code=code-gabi&state=${encodeURIComponent(state)}` });
    expect(csrf.statusCode).toBe(302);
    expect(csrf.headers.location).toContain('/ingresar?error=google');

    // Callback OK: cuenta nueva, sesión, bienvenida y redirección al next.
    const cb = await app.inject({
      method: 'GET',
      url: `/auth/google/callback?code=code-gabi&state=${encodeURIComponent(state)}`,
      cookies: { vedere_oauth_state: state },
    });
    expect(cb.statusCode).toBe(302);
    expect(cb.headers.location).toBe('http://localhost:3000/mi-cuenta/pedidos?bienvenida=1');
    const cookies = cookieDe(cb);
    expect(cookies.vedere_access).toBeTruthy();
    expect(cookies.vedere_refresh).toBeTruthy();
    const gabi = await prisma.user.findUniqueOrThrow({ where: { email: 'gabi@cuenta.vedere' } });
    expect(gabi).toMatchObject({ googleId: 'g-123', rol: 'CLIENTE', nombre: 'Gabi Sosa' });
    expect(await prisma.emailEnviado.count({ where: { para: 'gabi@cuenta.vedere', tipo: 'BIENVENIDA' } })).toBe(1);

    const me = await app.inject({ method: 'GET', url: '/cuenta', cookies: { vedere_access: cookies.vedere_access! } });
    expect(me.json().user).toMatchObject({ googleVinculado: true, tienePassword: false });
    // Sin contraseña no entra por email/contraseña...
    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'gabi@cuenta.vedere', password: 'vedere-dummy-password' } })).statusCode).toBe(401);
    // ...pero puede elegir una sin la actual.
    const pw = await app.inject({ method: 'PUT', url: '/cuenta/password', cookies: { vedere_access: cookies.vedere_access! }, payload: { nueva: 'mi-contraseña-nueva' } });
    expect(pw.statusCode).toBe(204);
    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'gabi@cuenta.vedere', password: 'mi-contraseña-nueva' } })).statusCode).toBe(200);

    // Cuenta existente por email: se vincula (sin bienvenida nueva).
    const start2 = await app.inject({ method: 'GET', url: '/auth/google' });
    const state2 = cookieDe(start2).vedere_oauth_state!;
    const cb2 = await app.inject({ method: 'GET', url: `/auth/google/callback?code=code-ana&state=${encodeURIComponent(state2)}`, cookies: { vedere_oauth_state: state2 } });
    expect(cb2.statusCode).toBe(302);
    expect(cb2.headers.location).toBe('http://localhost:3000/mi-cuenta');
    expect((await prisma.user.findUniqueOrThrow({ where: { email: 'ana@cuenta.vedere' } })).googleId).toBe('g-ana');
    expect(await prisma.emailEnviado.count({ where: { para: 'ana@cuenta.vedere', tipo: 'BIENVENIDA' } })).toBe(1);

    // Email no verificado y código rechazado por Google: error.
    const start3 = await app.inject({ method: 'GET', url: '/auth/google' });
    const state3 = cookieDe(start3).vedere_oauth_state!;
    const cb3 = await app.inject({ method: 'GET', url: `/auth/google/callback?code=code-nov&state=${encodeURIComponent(state3)}`, cookies: { vedere_oauth_state: state3 } });
    expect(cb3.headers.location).toContain('motivo=email-no-verificado');
    const cb4 = await app.inject({ method: 'GET', url: `/auth/google/callback?code=code-malo&state=${encodeURIComponent(state3)}`, cookies: { vedere_oauth_state: state3 } });
    expect(cb4.headers.location).toContain('motivo=google');
    expect(await prisma.user.count({ where: { email: 'nov@cuenta.vedere' } })).toBe(0);
  });

  it('sin GOOGLE_CLIENT_ID el login con Google responde 404', async () => {
    const { buildApp } = await import('../src/app.js');
    const sinGoogle = await buildApp({ env: testEnv({ DATABASE_URL: process.env.TEST_DATABASE_URL!, STORAGE_DRIVER: 'local' }), logger: false });
    await sinGoogle.ready();
    const res = await sinGoogle.inject({ method: 'GET', url: '/auth/google' });
    expect(res.statusCode).toBe(404);
    await sinGoogle.close();
  });

  it('direcciones: alta, predeterminada, edición y baja', async () => {
    const hugo = await registrar('hugo@cuenta.vedere', 'Hugo');
    const invalida = await app.inject({ method: 'POST', url: '/cuenta/direcciones', cookies: hugo.cookie, payload: { ...direccion, codigoPostal: 'abc' } });
    expect(invalida.statusCode).toBe(400);

    const casa = await app.inject({ method: 'POST', url: '/cuenta/direcciones', cookies: hugo.cookie, payload: { ...direccion, etiqueta: 'Casa', piso: '3B' } });
    expect(casa.statusCode).toBe(201);
    expect(casa.json()).toMatchObject({ etiqueta: 'Casa', piso: '3B', predeterminada: true, codigoPostal: '1425' });

    const trabajo = await app.inject({
      method: 'POST',
      url: '/cuenta/direcciones',
      cookies: hugo.cookie,
      payload: { ...direccion, direccion: 'Florida 100', localidad: 'CABA', etiqueta: 'Trabajo', telefono: '+54 11 1234-5678' },
    });
    expect(trabajo.statusCode).toBe(201);
    expect(trabajo.json().predeterminada).toBe(false);

    const pred = await app.inject({ method: 'POST', url: `/cuenta/direcciones/${trabajo.json().id}/predeterminada`, cookies: hugo.cookie });
    expect(pred.statusCode).toBe(200);
    let lista = await app.inject({ method: 'GET', url: '/cuenta/direcciones', cookies: hugo.cookie });
    expect(lista.json().items.map((d: { etiqueta: string; predeterminada: boolean }) => [d.etiqueta, d.predeterminada])).toEqual([
      ['Trabajo', true],
      ['Casa', false],
    ]);

    const edit = await app.inject({ method: 'PUT', url: `/cuenta/direcciones/${casa.json().id}`, cookies: hugo.cookie, payload: { ...direccion, etiqueta: 'Casa de mamá' } });
    expect(edit.statusCode).toBe(200);
    expect(edit.json().etiqueta).toBe('Casa de mamá');

    // Otra cuenta no la ve ni la toca.
    const ines = await registrar('ines@cuenta.vedere', 'Inés');
    expect((await app.inject({ method: 'DELETE', url: `/cuenta/direcciones/${casa.json().id}`, cookies: ines.cookie })).statusCode).toBe(404);

    // Borrar la predeterminada: la siguiente pasa a serlo.
    expect((await app.inject({ method: 'DELETE', url: `/cuenta/direcciones/${trabajo.json().id}`, cookies: hugo.cookie })).statusCode).toBe(204);
    lista = await app.inject({ method: 'GET', url: '/cuenta/direcciones', cookies: hugo.cookie });
    expect(lista.json().items).toHaveLength(1);
    expect(lista.json().items[0].predeterminada).toBe(true);
  });

  it('favoritos: sólo productos publicados, idempotente', async () => {
    const juan = await registrar('juan@cuenta.vedere', 'Juan');
    expect((await app.inject({ method: 'PUT', url: `/cuenta/favoritos/${ids.productoSol}`, cookies: juan.cookie })).statusCode).toBe(204);
    expect((await app.inject({ method: 'PUT', url: `/cuenta/favoritos/${ids.productoSol}`, cookies: juan.cookie })).statusCode).toBe(204);
    expect((await app.inject({ method: 'PUT', url: `/cuenta/favoritos/${ids.productoBorrador}`, cookies: juan.cookie })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: `/cuenta/favoritos/no-existe`, cookies: juan.cookie })).statusCode).toBe(404);

    const idsRes = await app.inject({ method: 'GET', url: '/cuenta/favoritos/ids', cookies: juan.cookie });
    expect(idsRes.json().ids).toEqual([ids.productoSol]);
    const lista = await app.inject({ method: 'GET', url: '/cuenta/favoritos', cookies: juan.cookie });
    expect(lista.json().items).toHaveLength(1);
    expect(lista.json().items[0]).toMatchObject({ slug: 'sol-c', precio: 50000 });
    expect(lista.json().items[0].createdById).toBeUndefined();

    expect((await app.inject({ method: 'DELETE', url: `/cuenta/favoritos/${ids.productoSol}`, cookies: juan.cookie })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/cuenta/favoritos/ids', cookies: juan.cookie })).json().ids).toEqual([]);
  });

  it('pedidos, recetas y recompensa de referidos al aprobarse el primer pago', async () => {
    const lara = await registrar('lara@cuenta.vedere', 'Lara Díaz');
    const codigo = (await app.inject({ method: 'GET', url: '/cuenta/referidos', cookies: lara.cookie })).json().codigo as string;
    const mati = await registrar('mati@cuenta.vedere', 'Matías Ríos', codigo);

    // Matías compra un recetado con receta guardada en la cuenta, por transferencia.
    const res = await app.inject({
      method: 'POST',
      url: '/checkout/pedidos',
      cookies: mati.cookie,
      payload: {
        datos: { email: 'mati@cuenta.vedere', nombre: 'Matías Ríos', dni: '33123456', telefono: '+54 11 5555-1234' },
        entrega: { modalidad: 'RETIRO_OPTICA', opticaId: ids.optica, direccion },
        receta: { modo: 'VALORES', valores: { odEsfera: -1.25, oiEsfera: -1, dp: 63 }, guardar: true },
        pago: { metodo: 'TRANSFERENCIA' },
        items: [{ varianteId: ids.recetado, cantidad: 1, conReceta: true }],
      },
    });
    expect(res.statusCode).toBe(201);
    const pedido = res.json().pedido as { id: string; numero: string };

    // Lista y detalle en la cuenta; otra cuenta no lo ve.
    const lista = await app.inject({ method: 'GET', url: '/cuenta/pedidos', cookies: mati.cookie });
    expect(lista.json().items.map((p: { id: string }) => p.id)).toEqual([pedido.id]);
    const det = await app.inject({ method: 'GET', url: `/cuenta/pedidos/${pedido.id}`, cookies: mati.cookie });
    expect(det.statusCode).toBe(200);
    expect(det.json()).toMatchObject({ numero: pedido.numero, estado: 'PENDIENTE_PAGO' });
    expect(det.json().receta).toMatchObject({ modo: 'VALORES', odEsfera: -1.25 });
    expect(Array.isArray(det.json().eventos)).toBe(true);
    expect(det.json().emails).toBeUndefined();
    expect((await app.inject({ method: 'GET', url: `/cuenta/pedidos/${pedido.id}`, cookies: lara.cookie })).statusCode).toBe(403);

    // Receta guardada: aparece y no se puede borrar porque está en un pedido.
    const recetas = await app.inject({ method: 'GET', url: '/cuenta/recetas', cookies: mati.cookie });
    expect(recetas.json().items).toHaveLength(1);
    expect(recetas.json().items[0].pedidos).toEqual([{ id: pedido.id, numero: pedido.numero }]);
    expect((await app.inject({ method: 'DELETE', url: `/cuenta/recetas/${recetas.json().items[0].id}`, cookies: mati.cookie })).statusCode).toBe(409);
    const suelta = await prisma.receta.create({ data: { userId: mati.user.id, modo: 'OPTICA' } });
    expect((await app.inject({ method: 'DELETE', url: `/cuenta/recetas/${suelta.id}`, cookies: mati.cookie })).statusCode).toBe(204);
    expect((await app.inject({ method: 'DELETE', url: `/cuenta/recetas/${suelta.id}`, cookies: mati.cookie })).statusCode).toBe(404);

    // Todavía no hay cupones ni recompensa.
    expect(await prisma.cupon.count({ where: { codigo: { startsWith: 'REF-' } } })).toBe(0);

    // El admin confirma la transferencia → primer pago del referido → cupones para ambos.
    const ap = await app.inject({ method: 'POST', url: `/admin/pedidos/${pedido.id}/pago/aprobar`, cookies: staffCookie, payload: { nota: 'ok' } });
    expect(ap.statusCode).toBe(200);
    const cupones = await prisma.cupon.findMany({ where: { codigo: { startsWith: 'REF-' } }, orderBy: { createdAt: 'asc' } });
    expect(cupones).toHaveLength(2);
    for (const c of cupones) {
      expect(c).toMatchObject({ tipo: 'PORCENTAJE', usosMax: 1, usosMaxPorCliente: 1, activo: true });
      expect(Number(c.valor)).toBe(12);
      expect(c.vigenciaHasta!.getTime()).toBeGreaterThan(Date.now() + 80 * 86400 * 1000);
    }
    expect(cupones.map((c) => c.descripcion?.split(':')[0])).toEqual(['Referidos (lara@cuenta.vedere)', 'Referidos (mati@cuenta.vedere)']);
    const emails = await prisma.emailEnviado.findMany({ where: { tipo: 'REFERIDO_RECOMPENSA' } });
    expect(emails.map((e) => e.para).sort()).toEqual(['lara@cuenta.vedere', 'mati@cuenta.vedere']);
    expect(emails[0]!.asunto).toContain('12%');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: mati.user.id } })).referidoRecompensadoEn).not.toBeNull();

    // Aprobar de nuevo (webhook repetido) no duplica.
    await app.inject({ method: 'POST', url: `/admin/pedidos/${pedido.id}/pago/aprobar`, cookies: staffCookie });
    expect(await prisma.cupon.count({ where: { codigo: { startsWith: 'REF-' } } })).toBe(2);

    // Lara ve a Matías como "compró" y su cupón; Matías ve el suyo.
    const refLara = await app.inject({ method: 'GET', url: '/cuenta/referidos', cookies: lara.cookie });
    expect(refLara.json().referidos).toEqual([expect.objectContaining({ nombre: 'Matías R.', estado: 'COMPRO' })]);
    expect(refLara.json().cupones).toEqual([expect.objectContaining({ codigo: cupones[0]!.codigo, valor: 12, programa: 'REFERIDOS', activo: true })]);
    const refMati = await app.inject({ method: 'GET', url: '/cuenta/referidos', cookies: mati.cookie });
    expect(refMati.json().cupones.map((c: { codigo: string }) => c.codigo)).toEqual([cupones[1]!.codigo]);

    // El cupón se puede usar en el checkout (una vez).
    const val = await app.inject({ method: 'POST', url: '/catalogo/cupones/validar', payload: { codigo: cupones[1]!.codigo, email: 'mati@cuenta.vedere' } });
    expect(val.statusCode).toBe(200);

    // Resumen: Plan Rivedere a 24 meses de la compra de recetado.
    const resumen = await app.inject({ method: 'GET', url: '/cuenta', cookies: mati.cookie });
    expect(resumen.json().resumen).toMatchObject({ pedidos: 1, recetas: 1 });
    const ultima = new Date(resumen.json().rivedere.ultimaCompraRecetado);
    const proximo = new Date(resumen.json().rivedere.proximoAviso);
    expect(Math.round((proximo.getTime() - ultima.getTime()) / (30 * 86400 * 1000))).toBeGreaterThanOrEqual(23);

    // Una segunda compra de Matías no vuelve a premiar.
    const res2 = await app.inject({
      method: 'POST',
      url: '/checkout/pedidos',
      cookies: mati.cookie,
      payload: {
        datos: { email: 'mati@cuenta.vedere', nombre: 'Matías Ríos', dni: '33123456', telefono: '+54 11 5555-1234' },
        entrega: { modalidad: 'RETIRO_OPTICA', opticaId: ids.optica, direccion },
        pago: { metodo: 'TRANSFERENCIA' },
        items: [{ varianteId: ids.sol, cantidad: 1 }],
      },
    });
    expect(res2.statusCode).toBe(201);
    await app.inject({ method: 'POST', url: `/admin/pedidos/${res2.json().pedido.id}/pago/aprobar`, cookies: staffCookie });
    expect(await prisma.cupon.count({ where: { codigo: { startsWith: 'REF-' } } })).toBe(2);
  });
});
