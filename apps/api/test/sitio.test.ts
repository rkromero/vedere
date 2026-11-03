// Prompt 6 — sitio público y su backoffice: config pública, páginas legales, redirecciones, botón de
// arrepentimiento (número de trámite + emails), consulta de trámite, newsletter alta/baja y admin.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { crearContexto, crearPedido, emailsDe } from './prompt6-helpers.js';
import type { Contexto } from './prompt6-helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!hasDb)('sitio (integración)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await crearContexto();
    await ctx.prisma.paginaLegal.createMany({
      data: [
        { slug: 'terminos', titulo: 'Términos y condiciones', intro: 'Intro', contenido: '## 1. Generalidades\n\nTexto.', publicada: true },
        { slug: 'cookies', titulo: 'Cookies', contenido: 'Cookies.', publicada: false },
      ],
    });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /sitio/config expone datos fiscales y programas', async () => {
    const res = await ctx.inject('GET', '/sitio/config');
    expect(res.statusCode).toBe(200);
    const j = res.json();
    expect(j.fiscal.razonSocial).toBe('Vedere S.A.S.');
    expect(j.fiscal.cuit).toBe('30-00000000-0');
    expect(j.googleLogin).toBe(false);
    expect(j.rivedere).toEqual({ meses: 24, descuentoPct: 15 });
    expect(j.referidos.descuentoPct).toBe(10);
    expect(res.headers['cache-control']).toContain('max-age=60');
  });

  it('páginas legales: sólo publicadas en público, edición desde el admin', async () => {
    const lista = await ctx.inject('GET', '/sitio/paginas');
    expect(lista.json().items.map((p: { slug: string }) => p.slug)).toEqual(['terminos']);
    const pub = await ctx.inject('GET', '/sitio/paginas/terminos');
    expect(pub.statusCode).toBe(200);
    expect(pub.json().contenido).toContain('## 1. Generalidades');
    expect((await ctx.inject('GET', '/sitio/paginas/cookies')).statusCode).toBe(404);

    const edit = await ctx.inject('PUT', '/admin/paginas-legales/cookies', ctx.staffCookie, { titulo: 'Política de cookies', intro: null, contenido: 'Usamos cookies.', publicada: true });
    expect(edit.statusCode, edit.body).toBe(200);
    expect((await ctx.inject('GET', '/sitio/paginas/cookies')).json().titulo).toBe('Política de cookies');
    expect((await ctx.inject('GET', '/admin/paginas-legales', ctx.staffCookie)).json().items).toHaveLength(2);
    expect((await ctx.inject('PUT', '/admin/paginas-legales/inexistente', ctx.staffCookie, { titulo: 'Inexistente', contenido: 'Contenido de prueba.' })).statusCode).toBe(404);
  });

  it('redirecciones: alta sólo ADMIN, públicas activas, hit cuenta visitas', async () => {
    const operador = await ctx.prisma.user.create({ data: { email: 'op@p6.vedere', nombre: 'Op', rol: 'OPERADOR', passwordHash: 'x' } });
    const opCookie = { vedere_access: ctx.app.jwt.sign({ sub: operador.id, email: operador.email, rol: 'OPERADOR' }) };
    expect((await ctx.inject('POST', '/admin/redirecciones', opCookie, { origen: '/vieja', destino: '/sol' })).statusCode).toBe(403);

    const alta = await ctx.inject('POST', '/admin/redirecciones', ctx.staffCookie, { origen: '/vieja/', destino: '/sol' });
    expect(alta.statusCode, alta.body).toBe(201);
    expect(alta.json().origen).toBe('/vieja');
    expect((await ctx.inject('POST', '/admin/redirecciones', ctx.staffCookie, { origen: '/vieja', destino: '/otro' })).statusCode).toBe(409);
    expect((await ctx.inject('POST', '/admin/redirecciones', ctx.staffCookie, { origen: '/igual', destino: '/igual' })).statusCode).toBe(400);
    expect((await ctx.inject('POST', '/admin/redirecciones', ctx.staffCookie, { origen: 'sin-barra', destino: '/x' })).statusCode).toBe(400);
    const inactiva = await ctx.inject('POST', '/admin/redirecciones', ctx.staffCookie, { origen: '/apagada', destino: '/faq', activa: false, permanente: false });
    expect(inactiva.statusCode).toBe(201);

    const pub = await ctx.inject('GET', '/sitio/redirecciones');
    expect(pub.json().items).toEqual([{ origen: '/vieja', destino: '/sol', permanente: true }]);

    expect((await ctx.inject('POST', '/sitio/redirecciones/hit', undefined, { origen: '/vieja' })).statusCode).toBe(204);
    expect((await ctx.inject('POST', '/sitio/redirecciones/hit', undefined, { origen: '/vieja' })).statusCode).toBe(204);
    const admin = await ctx.inject('GET', '/admin/redirecciones', ctx.staffCookie);
    expect(admin.json().items.find((r: { origen: string }) => r.origen === '/vieja').hits).toBe(2);

    const upd = await ctx.inject('PUT', `/admin/redirecciones/${inactiva.json().id}`, ctx.staffCookie, { activa: true, destino: 'https://vedere.com.ar/faq' });
    expect(upd.statusCode, upd.body).toBe(200);
    expect((await ctx.inject('GET', '/sitio/redirecciones')).json().items).toHaveLength(2);
    expect((await ctx.inject('DELETE', `/admin/redirecciones/${inactiva.json().id}`, ctx.staffCookie)).statusCode).toBe(204);
    expect((await ctx.inject('DELETE', `/admin/redirecciones/${inactiva.json().id}`, ctx.staffCookie)).statusCode).toBe(404);
  });

  it('botón de arrepentimiento: número de trámite, vínculo con el pedido, emails al cliente y al admin', async () => {
    const pedido = await crearPedido(ctx);
    const anio = new Date().getFullYear();

    const res = await ctx.inject('POST', '/sitio/arrepentimiento', undefined, {
      nombre: 'Ana Pérez',
      email: 'cli@p6.vedere',
      dni: '30123456',
      telefono: '11 5555-1234',
      pedidoNumero: pedido.numero.toLowerCase(),
      motivo: 'Me arrepentí de la compra.',
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().numeroTramite).toBe(`ARR-${anio}-000001`);

    const segundo = await ctx.inject('POST', '/sitio/arrepentimiento', undefined, { nombre: 'Otro Cliente', email: 'otro@p6.vedere', pedidoNumero: 'VD-99999' });
    expect(segundo.json().numeroTramite).toBe(`ARR-${anio}-000002`);

    const fila = await ctx.prisma.arrepentimiento.findUniqueOrThrow({ where: { numeroTramite: `ARR-${anio}-000001` } });
    expect(fila.pedidoId).toBe(pedido.id);
    expect(fila.pedidoNumero).toBe(pedido.numero);
    expect(fila.estado).toBe('RECIBIDO');
    const otro = await ctx.prisma.arrepentimiento.findUniqueOrThrow({ where: { numeroTramite: `ARR-${anio}-000002` } });
    expect(otro.pedidoId).toBeNull();
    expect(otro.pedidoNumero).toBe('VD-99999');

    const cliente = await emailsDe(ctx.prisma, { tipo: 'ARREPENTIMIENTO_RECIBIDO', para: 'cli@p6.vedere' });
    expect(cliente).toHaveLength(1);
    expect(cliente[0]!.asunto).toContain(`ARR-${anio}-000001`);
    expect(cliente[0]!.estado).toBe('SIMULADO');
    const admin = await emailsDe(ctx.prisma, { tipo: 'ADMIN_ARREPENTIMIENTO' });
    expect(admin).toHaveLength(2);
    expect(admin[0]!.para).toBe('equipo@p6.vedere');
    expect(admin[0]!.pedidoId).toBe(pedido.id);

    // Honeypot: no guarda nada.
    const bot = await ctx.inject('POST', '/sitio/arrepentimiento', undefined, { nombre: 'Bot', email: 'bot@p6.vedere', web: 'http://spam' });
    expect(bot.statusCode).toBe(201);
    expect(await ctx.prisma.arrepentimiento.count()).toBe(2);

    // Validación
    const malo = await ctx.inject('POST', '/sitio/arrepentimiento', undefined, { nombre: 'A', email: 'no-es-email', dni: '12' });
    expect(malo.statusCode).toBe(400);
    const paths = (malo.json().error.details as Array<{ path: string }>).map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['nombre', 'email', 'dni']));

    // Consulta pública
    const consulta = await ctx.inject('GET', `/sitio/arrepentimiento/arr-${anio}-000001?email=cli@p6.vedere`);
    expect(consulta.statusCode).toBe(200);
    expect(consulta.json().estado).toBe('RECIBIDO');
    expect((await ctx.inject('GET', `/sitio/arrepentimiento/ARR-${anio}-000001?email=otro@p6.vedere`)).statusCode).toBe(404);
  });

  it('admin: listado con resumen y búsqueda, detalle con pedido, resolver manda email con la respuesta', async () => {
    const lista = await ctx.inject('GET', '/admin/arrepentimientos?q=ana', ctx.staffCookie);
    expect(lista.statusCode).toBe(200);
    expect(lista.json().total).toBe(1);
    expect(lista.json().resumen.RECIBIDO).toBe(2);
    const id = lista.json().items[0].id as string;

    const det = await ctx.inject('GET', `/admin/arrepentimientos/${id}`, ctx.staffCookie);
    expect(det.json().pedido.numero).toMatch(/^VD-/);

    const enProceso = await ctx.inject('PUT', `/admin/arrepentimientos/${id}`, ctx.staffCookie, { estado: 'EN_PROCESO' });
    expect(enProceso.json().estado).toBe('EN_PROCESO');
    expect(enProceso.json().resueltoEn).toBeNull();
    expect(await emailsDe(ctx.prisma, { tipo: 'ARREPENTIMIENTO_RESPUESTA' })).toHaveLength(0);

    const resuelto = await ctx.inject('PUT', `/admin/arrepentimientos/${id}`, ctx.staffCookie, { estado: 'RESUELTO', respuesta: 'Reintegro emitido por Mercado Pago.' });
    expect(resuelto.statusCode, resuelto.body).toBe(200);
    expect(resuelto.json().resueltoEn).not.toBeNull();
    expect(resuelto.json().resueltoPorId).toBe(ctx.ids.admin);
    const respuesta = await emailsDe(ctx.prisma, { tipo: 'ARREPENTIMIENTO_RESPUESTA' });
    expect(respuesta).toHaveLength(1);
    expect(respuesta[0]!.para).toBe('cli@p6.vedere');

    // Repetir el mismo estado no vuelve a mandar email.
    await ctx.inject('PUT', `/admin/arrepentimientos/${id}`, ctx.staffCookie, { estado: 'RESUELTO' });
    expect(await emailsDe(ctx.prisma, { tipo: 'ARREPENTIMIENTO_RESPUESTA' })).toHaveLength(1);

    const filtrado = await ctx.inject('GET', '/admin/arrepentimientos?estado=RESUELTO', ctx.staffCookie);
    expect(filtrado.json().total).toBe(1);
    expect((await ctx.inject('GET', '/admin/arrepentimientos', ctx.clienteCookie)).statusCode).toBe(403);
  });

  it('newsletter: alta con nombre manda confirmación con link de baja; la baja es por token; reactivar vuelve a confirmar', async () => {
    const alta = await ctx.inject('POST', '/catalogo/newsletter', undefined, { email: 'News@p6.vedere', nombre: 'Noe', origen: 'footer' });
    expect(alta.statusCode, alta.body).toBe(201);
    const s = await ctx.prisma.suscripcionNewsletter.findUniqueOrThrow({ where: { email: 'news@p6.vedere' } });
    expect(s.nombre).toBe('Noe');
    expect(s.token).toBeTruthy();
    let emails = await emailsDe(ctx.prisma, { tipo: 'NEWSLETTER_ALTA', para: 'news@p6.vedere' });
    expect(emails).toHaveLength(1);

    // Reenviar el formulario estando activo no vuelve a mandar email.
    await ctx.inject('POST', '/catalogo/newsletter', undefined, { email: 'news@p6.vedere' });
    emails = await emailsDe(ctx.prisma, { tipo: 'NEWSLETTER_ALTA', para: 'news@p6.vedere' });
    expect(emails).toHaveLength(1);

    const info = await ctx.inject('GET', `/sitio/newsletter/baja/${s.token}`);
    expect(info.json()).toEqual({ email: 'news@p6.vedere', activa: true });
    expect((await ctx.inject('POST', `/sitio/newsletter/baja/${s.token}`)).statusCode).toBe(204);
    expect((await ctx.inject('GET', `/sitio/newsletter/baja/${s.token}`)).json().activa).toBe(false);
    expect((await ctx.inject('GET', '/sitio/newsletter/baja/token-inexistente')).statusCode).toBe(404);

    // Reactivación → nuevo email de confirmación.
    await ctx.inject('POST', '/catalogo/newsletter', undefined, { email: 'news@p6.vedere' });
    expect((await ctx.prisma.suscripcionNewsletter.findUniqueOrThrow({ where: { email: 'news@p6.vedere' } })).bajaEn).toBeNull();
    expect(await emailsDe(ctx.prisma, { tipo: 'NEWSLETTER_ALTA', para: 'news@p6.vedere' })).toHaveLength(2);

    // Admin
    await ctx.inject('POST', '/catalogo/newsletter', undefined, { email: 'baja@p6.vedere' });
    const b = await ctx.prisma.suscripcionNewsletter.findUniqueOrThrow({ where: { email: 'baja@p6.vedere' } });
    await ctx.inject('POST', `/sitio/newsletter/baja/${b.token}`);
    const admin = await ctx.inject('GET', '/admin/newsletter?estado=activos', ctx.staffCookie);
    expect(admin.statusCode).toBe(200);
    expect(admin.json().total).toBe(1);
    expect(admin.json().resumen).toEqual({ activos: 1, bajas: 1 });
    expect(admin.json().items[0].token).toBeUndefined();
    const csv = await ctx.inject('GET', '/admin/newsletter/csv', ctx.staffCookie);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body).toContain('news@p6.vedere');
    expect(csv.body).toContain('baja@p6.vedere');
    expect((await ctx.inject('DELETE', `/admin/newsletter/${b.id}`, ctx.staffCookie)).statusCode).toBe(204);
    expect((await ctx.inject('GET', '/admin/newsletter', ctx.staffCookie)).json().total).toBe(1);
  });

  it('config-tienda: el ADMIN edita datos fiscales y programas', async () => {
    const res = await ctx.inject('PUT', '/admin/config-tienda', ctx.staffCookie, {
      razonSocial: 'Vedere Óptica S.A.S.',
      cuit: '30-71234567-8',
      emailContacto: 'Hola@Vedere.com.ar',
      rivedereMeses: 18,
      rivedereDescuentoPct: 20,
      referidoDescuentoPct: 12.5,
      carritoAbandonadoHabilitado: false,
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ razonSocial: 'Vedere Óptica S.A.S.', cuit: '30-71234567-8', emailContacto: 'hola@vedere.com.ar', rivedereMeses: 18, rivedereDescuentoPct: 20, referidoDescuentoPct: 12.5, carritoAbandonadoHabilitado: false });
    expect((await ctx.inject('PUT', '/admin/config-tienda', ctx.staffCookie, { cuit: '123' })).statusCode).toBe(400);
    const pub = await ctx.inject('GET', '/sitio/config');
    expect(pub.json().rivedere).toEqual({ meses: 18, descuentoPct: 20 });
    expect(pub.json().carritoAbandonado).toBe(false);
    const get = await ctx.inject('GET', '/admin/config-tienda', ctx.staffCookie);
    // Flags del entorno: dependen de las variables presentes (en CI no hay ninguna; en local puede haber CRON_SECRET).
    const entorno = get.json().entorno as Record<string, unknown>;
    for (const k of ['googleLogin', 'metaCapi', 'ga4Mp', 'sentry', 'cronSecret']) expect(typeof entorno[k]).toBe('boolean');
    expect(entorno.cronSecret).toBe(!!process.env.CRON_SECRET);
    expect(entorno.googleLogin).toBe(!!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET));
    await ctx.inject('PUT', '/admin/config-tienda', ctx.staffCookie, { carritoAbandonadoHabilitado: true });
  });
});
