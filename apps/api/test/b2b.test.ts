// Tests del prompt B2B 1: precio mayorista y visibilidad por canal (nunca sale en la tienda), CSV con las columnas
// nuevas, actualización masiva de precios auditada, validación de CUIT, solicitud de alta de ópticas,
// aprobación / rechazo con emails, contraseña provisoria y usuarios del equipo de la óptica.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorCuit, formatearCuit } from '../src/lib/cuit.js';
import { aplicarPorcentaje } from '../src/lib/precios.js';
import { CSV_COLUMNS } from '../src/routes/admin/csv.js';
import { crearContexto } from './prompt6-helpers.js';
import type { Contexto, Cookies } from './prompt6-helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;

describe('CUIT (unitario)', () => {
  it('acepta CUIT válidos con o sin guiones', () => {
    expect(errorCuit('20-12345678-6')).toBeNull();
    expect(errorCuit('30711111111')).toBeNull();
    expect(errorCuit('27 28999888 3')).toBeNull();
    expect(formatearCuit('30711111111')).toBe('30-71111111-1');
  });
  it('rechaza formato, tipo y dígito verificador', () => {
    expect(errorCuit('2012345678')).toBe('formato');
    expect(errorCuit('20-1234567A-6')).toBe('formato');
    expect(errorCuit('11-12345678-9')).toBe('tipo');
    expect(errorCuit('20-12345678-5')).toBe('verificador');
  });
});

describe('aplicarPorcentaje (unitario)', () => {
  it('aplica el porcentaje y redondea', () => {
    expect(aplicarPorcentaje(1000, 10, 1)).toBe(1100);
    expect(aplicarPorcentaje(1234, 15, 10)).toBe(1420);
    expect(aplicarPorcentaje(99999, -10, 100)).toBe(90000);
    expect(aplicarPorcentaje(100.5, 3.3, 0.01)).toBe(103.82);
  });
});

/** Valor distintivo: si aparece en una respuesta pública, se filtró el precio mayorista. */
const MAYORISTA = 43217.89;

describe.skipIf(!hasDb)('B2B 1: canal mayorista y alta de ópticas (integración)', () => {
  let ctx: Contexto;
  let visible = '';
  let oculto = '';
  let varianteOculta = '';

  beforeAll(async () => {
    ctx = await crearContexto();
    const { prisma } = ctx;
    // Sol A del contexto pasa a tener precio mayorista; se suma un producto sólo mayorista.
    await prisma.producto.update({ where: { id: ctx.ids.productoSol }, data: { precioMayorista: MAYORISTA } });
    visible = ctx.ids.productoSol;
    const p = await prisma.producto.create({
      data: {
        nombre: 'Aviador Exclusivo Ópticas',
        slug: 'aviador-exclusivo',
        linea: 'SOL',
        precio: 120000,
        precioMayorista: MAYORISTA,
        visibleTienda: false,
        visibleMayorista: true,
        estado: 'PUBLICADO',
        publicadoEn: new Date(),
        coleccionId: ctx.ids.coleccion,
        variantes: { create: [{ sku: 'B2B-AVI-ORO', colorArmazon: 'Oro', stock: 8 }] },
      },
      include: { variantes: true },
    });
    oculto = p.id;
    varianteOculta = p.variantes[0]!.id;
    const { invalidarFeeds } = await import('../src/lib/feeds.js');
    invalidarFeeds();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  // ---------------------------------------------------------------
  // Catálogo
  // ---------------------------------------------------------------

  it('ninguna respuesta pública incluye precioMayorista (catálogo, ficha, relacionados, buscador, filtros, feeds, sitemap)', async () => {
    const urls = [
      '/catalogo/productos?pageSize=100',
      '/catalogo/productos?q=sol',
      '/catalogo/productos/sol-a',
      '/catalogo/productos/sol-a/relacionados',
      '/catalogo/sugerencias?q=sol',
      '/catalogo/sugerencias?q=aviador',
      '/catalogo/filtros',
      '/catalogo/colecciones',
      '/catalogo/categorias',
      '/feeds/google.xml',
      '/feeds/meta.csv',
    ];
    for (const url of urls) {
      const res = await ctx.inject('GET', url);
      expect(res.statusCode, url).toBe(200);
      expect(res.body, url).not.toMatch(/precioMayorista|precio_mayorista|visibleMayorista|visibleTienda/);
      expect(res.body, url).not.toContain('43217');
    }
    // Ficha pública: tiene el precio web pero no el mayorista.
    const ficha = (await ctx.inject('GET', '/catalogo/productos/sol-a')).json();
    expect(ficha.precio).toBe(90000);
    expect(ficha).not.toHaveProperty('precioMayorista');
    // Favoritos de la cuenta (también es una respuesta de la tienda).
    await ctx.inject('PUT', `/cuenta/favoritos/${visible}`, ctx.clienteCookie);
    const fav = await ctx.inject('GET', '/cuenta/favoritos', ctx.clienteCookie);
    expect(fav.statusCode).toBe(200);
    expect(fav.body).not.toMatch(/precioMayorista|43217/);
  });

  it('un producto con visibleTienda = false no aparece en la tienda, el buscador, los feeds ni se puede comprar', async () => {
    const lista = (await ctx.inject('GET', '/catalogo/productos?pageSize=100')).json();
    expect(lista.items.map((p: { id: string }) => p.id)).not.toContain(oculto);
    expect(lista.items.map((p: { id: string }) => p.id)).toContain(visible);

    expect((await ctx.inject('GET', '/catalogo/productos/aviador-exclusivo')).statusCode).toBe(404);
    expect((await ctx.inject('GET', '/catalogo/productos/aviador-exclusivo/relacionados')).statusCode).toBe(404);
    const rel = (await ctx.inject('GET', '/catalogo/productos/sol-a/relacionados')).json();
    expect(rel.items.map((p: { id: string }) => p.id)).not.toContain(oculto);

    const sug = (await ctx.inject('GET', '/catalogo/sugerencias?q=aviador')).json();
    expect(sug.productos).toHaveLength(0);
    const busq = (await ctx.inject('GET', '/catalogo/productos?q=exclusivo')).json();
    expect(busq.total).toBe(0);

    const xml = (await ctx.inject('GET', '/feeds/google.xml')).body;
    const csv = (await ctx.inject('GET', '/feeds/meta.csv')).body;
    expect(xml).not.toContain('B2B-AVI-ORO');
    expect(csv).not.toContain('B2B-AVI-ORO');
    expect(xml).not.toContain('aviador-exclusivo');

    // El sitemap de la web se arma con /catalogo/productos?pageSize=100&orden=novedades.
    const sitemap = (await ctx.inject('GET', '/catalogo/productos?pageSize=100&orden=novedades')).json();
    expect(sitemap.items.map((p: { slug: string }) => p.slug)).not.toContain('aviador-exclusivo');

    const cot = await ctx.inject('POST', '/checkout/cotizar', undefined, {
      items: [{ varianteId: varianteOculta, cantidad: 1 }],
      modalidad: 'RETIRO_OPTICA',
    });
    expect(cot.statusCode).toBe(400);
    expect(cot.json().error.message).toMatch(/ya no están disponibles/);
  });

  it('el admin ve y edita precio mayorista y visibilidad por canal; los filtros por canal funcionan', async () => {
    const det = (await ctx.inject('GET', `/admin/productos/${oculto}`, ctx.staffCookie)).json();
    expect(det.precioMayorista).toBe(MAYORISTA);
    expect(det.visibleTienda).toBe(false);
    expect(det.visibleMayorista).toBe(true);

    const nuevo = await ctx.inject('POST', '/admin/productos', ctx.staffCookie, {
      nombre: 'Redondo Canal Web',
      linea: 'RECETADO',
      precio: 80000,
      precioMayorista: 30000,
      estado: 'PUBLICADO',
    });
    expect(nuevo.statusCode).toBe(201);
    expect(nuevo.json()).toMatchObject({ precioMayorista: 30000, visibleTienda: true, visibleMayorista: true });

    const upd = await ctx.inject('PUT', `/admin/productos/${nuevo.json().id}`, ctx.staffCookie, { visibleMayorista: false, precioMayorista: null });
    expect(upd.json()).toMatchObject({ precioMayorista: null, visibleTienda: true, visibleMayorista: false });

    const neg = await ctx.inject('PUT', `/admin/productos/${nuevo.json().id}`, ctx.staffCookie, { precioMayorista: -5 });
    expect(neg.statusCode).toBe(400);

    const solo = (await ctx.inject('GET', '/admin/productos?canal=solo_mayorista', ctx.staffCookie)).json();
    expect(solo.items.map((p: { id: string }) => p.id)).toEqual([oculto]);
    const sin = (await ctx.inject('GET', '/admin/productos?canal=sin_mayorista&pageSize=100', ctx.staffCookie)).json();
    expect(sin.items.map((p: { id: string }) => p.id)).toContain(nuevo.json().id);
    expect(sin.items.map((p: { id: string }) => p.id)).not.toContain(oculto);
  });

  it('CSV: exporta e importa precio_mayorista y visibilidad; un CSV viejo sin esas columnas no las pisa', async () => {
    const exp = await ctx.inject('GET', '/admin/productos/export.csv', ctx.staffCookie);
    expect(exp.statusCode).toBe(200);
    const header = exp.body.replace(/^\uFEFF/, '').split('\n')[0]!;
    expect(header).toContain('precio_mayorista,visible_tienda,visible_mayorista');
    expect(exp.body).toMatch(/aviador-exclusivo,.*43217\.89,no,si/);

    const NUEVAS = ['precio_mayorista', 'visible_tienda', 'visible_mayorista'];
    const fila = (cols: readonly string[], v: Record<string, string>) => cols.map((c) => v[c] ?? '').join(',');
    const datos = { producto_slug: 'aviador-exclusivo', nombre: 'Aviador Exclusivo Ópticas', linea: 'SOL', estado: 'PUBLICADO', sku: 'B2B-AVI-ORO', color_armazon: 'Oro', stock: '8' };
    const csvDe = (cols: readonly string[], v: Record<string, string>) => `${cols.join(',')}
${fila(cols, { ...datos, ...v })}
`;

    const conColumnas = csvDe(CSV_COLUMNS, { precio: '125000', precio_mayorista: '50000', visible_tienda: 'si', visible_mayorista: 'no' });
    const imp = await ctx.inject('POST', '/admin/productos/import', ctx.staffCookie, { csv: conColumnas });
    expect(imp.statusCode, imp.body).toBe(200);
    let p = await ctx.prisma.producto.findUniqueOrThrow({ where: { id: oculto } });
    expect(Number(p.precioMayorista)).toBe(50000);
    expect(p.visibleTienda).toBe(true);
    expect(p.visibleMayorista).toBe(false);

    // CSV exportado antes de este cambio (sin las columnas nuevas): no pisa mayorista ni visibilidad.
    const viejo = csvDe(CSV_COLUMNS.filter((c) => !NUEVAS.includes(c)), { precio: '126000' });
    const impViejo = await ctx.inject('POST', '/admin/productos/import', ctx.staffCookie, { csv: viejo });
    expect(impViejo.statusCode, impViejo.body).toBe(200);
    p = await ctx.prisma.producto.findUniqueOrThrow({ where: { id: oculto } });
    expect(Number(p.precio)).toBe(126000);
    expect(Number(p.precioMayorista)).toBe(50000);
    expect(p.visibleTienda).toBe(true);
    expect(p.visibleMayorista).toBe(false);

    const malo = csvDe(CSV_COLUMNS, { precio: '1', precio_mayorista: '-3' });
    const r = await ctx.inject('POST', '/admin/productos/import', ctx.staffCookie, { csv: malo });
    expect(r.statusCode).toBe(400);
    expect(JSON.stringify(r.json())).toContain('precio_mayorista');

    // Vuelve a quedar oculto en la tienda para el resto de los tests.
    await ctx.prisma.producto.update({ where: { id: oculto }, data: { visibleTienda: false, visibleMayorista: true, precioMayorista: MAYORISTA } });
  });

  it('actualización masiva por porcentaje: vista previa, aplica sólo al alcance y queda auditada', async () => {
    const antesOtro = await ctx.prisma.producto.findUniqueOrThrow({ where: { slug: 'redondo-canal-web' } }); // sin colección
    const enVerano = await ctx.prisma.producto.count({ where: { coleccionId: ctx.ids.coleccion } });

    const prev = await ctx.inject('POST', '/admin/productos/precios', ctx.staffCookie, {
      campo: 'PRECIO',
      porcentaje: 10,
      alcance: 'COLECCION',
      alcanceId: ctx.ids.coleccion,
      simular: true,
    });
    expect(prev.statusCode).toBe(200);
    expect(prev.json()).toMatchObject({ simulado: true, productosAfectados: enVerano, alcanceNombre: 'Verano' });
    expect(Number((await ctx.prisma.producto.findUniqueOrThrow({ where: { id: visible } })).precio)).toBe(90000);

    const ok = await ctx.inject('POST', '/admin/productos/precios', ctx.staffCookie, {
      campo: 'PRECIO',
      porcentaje: 10,
      alcance: 'COLECCION',
      alcanceId: ctx.ids.coleccion,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().simulado).toBe(false);
    expect(Number((await ctx.prisma.producto.findUniqueOrThrow({ where: { id: visible } })).precio)).toBe(99000);
    const otro = await ctx.prisma.producto.findUniqueOrThrow({ where: { slug: 'redondo-canal-web' } });
    expect(Number(otro.precio)).toBe(Number(antesOtro.precio));

    const may = await ctx.inject('POST', '/admin/productos/precios', ctx.staffCookie, {
      campo: 'PRECIO_MAYORISTA',
      porcentaje: -10,
      alcance: 'TODOS',
      redondeo: 0.01,
    });
    expect(may.statusCode).toBe(200);
    // Sólo los que tienen precio mayorista cargado.
    expect(may.json().detalle.every((d: { antes: number }) => d.antes > 0)).toBe(true);
    expect(Number((await ctx.prisma.producto.findUniqueOrThrow({ where: { id: oculto } })).precioMayorista)).toBe(38896.1);

    const hist = (await ctx.inject('GET', '/admin/productos/precios/historial', ctx.staffCookie)).json();
    expect(hist.total).toBe(2);
    expect(hist.items[0]).toMatchObject({ campo: 'PRECIO_MAYORISTA', porcentaje: -10, alcance: 'TODOS', usuarioNombre: 'Admin P6' });
    expect(hist.items[1]).toMatchObject({ campo: 'PRECIO', porcentaje: 10, alcance: 'COLECCION', productosAfectados: enVerano });
    expect(hist.items[1].detalle).toContainEqual(expect.objectContaining({ id: visible, antes: 90000, despues: 99000 }));

    const sinAlcance = await ctx.inject('POST', '/admin/productos/precios', ctx.staffCookie, { campo: 'PRECIO', porcentaje: 5, alcance: 'MARCA' });
    expect(sinAlcance.statusCode).toBe(400);
    const cero = await ctx.inject('POST', '/admin/productos/precios', ctx.staffCookie, { campo: 'PRECIO', porcentaje: 0, alcance: 'TODOS' });
    expect(cero.statusCode).toBe(400);
    // Un cliente no puede tocar precios.
    expect((await ctx.inject('POST', '/admin/productos/precios', ctx.clienteCookie, { campo: 'PRECIO', porcentaje: 5, alcance: 'TODOS' })).statusCode).toBe(403);
  });

  // ---------------------------------------------------------------
  // Alta de ópticas
  // ---------------------------------------------------------------

  const solicitudBase = {
    razonSocial: 'Óptica Norte SRL',
    nombreComercial: 'Óptica Norte',
    cuit: '30-71111111-1',
    condicionIva: 'RESPONSABLE_INSCRIPTO',
    direccion: 'Av. Maipú 1200',
    localidad: 'Vicente López',
    provincia: 'Buenos Aires',
    codigoPostal: '1638',
    telefono: '+54 11 4795-0000',
    whatsapp: '+54 9 11 5000-0000',
    email: 'Duenia@OpticaNorte.test',
    opticoResponsable: 'Marta Quiroga',
    matricula: 'MN 4521',
    aceptaTerminos: true,
  };
  let solicitudId = '';
  let habilitacionUrl = '';

  async function subirHabilitacion(tipo = 'application/pdf', nombre = 'habilitacion.pdf') {
    const boundary = 'xxB2Bxx';
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${nombre}"\r\nContent-Type: ${tipo}\r\n\r\n`),
      Buffer.from('%PDF-1.4 habilitacion municipal'),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return ctx.app.inject({
      method: 'POST',
      url: '/sitio/opticas/habilitacion',
      payload,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    });
  }

  it('la habilitación se sube como PDF o imagen (otros formatos no)', async () => {
    const res = await subirHabilitacion();
    expect(res.statusCode).toBe(201);
    habilitacionUrl = res.json().url;
    expect(habilitacionUrl).toContain('/opticas-habilitaciones/');
    const malo = await subirHabilitacion('text/plain', 'x.txt');
    expect(malo.statusCode).toBe(400);
    expect(malo.json().error.message).toMatch(/habilitación/);
  });

  it('un CUIT inválido se rechaza con un mensaje claro', async () => {
    const r1 = await ctx.inject('POST', '/sitio/opticas/solicitudes', undefined, { ...solicitudBase, habilitacionUrl, cuit: '30-71111111-9' });
    expect(r1.statusCode).toBe(400);
    expect(JSON.stringify(r1.json())).toContain('dígito verificador no coincide');
    const r2 = await ctx.inject('POST', '/sitio/opticas/solicitudes', undefined, { ...solicitudBase, habilitacionUrl, cuit: '123' });
    expect(r2.statusCode).toBe(400);
    expect(JSON.stringify(r2.json())).toContain('11 números');
    const r3 = await ctx.inject('POST', '/sitio/opticas/solicitudes', undefined, { ...solicitudBase, habilitacionUrl, aceptaTerminos: false });
    expect(r3.statusCode).toBe(400);
    expect(JSON.stringify(r3.json())).toContain('términos');
    const r4 = await ctx.inject('POST', '/sitio/opticas/solicitudes', undefined, { ...solicitudBase, habilitacionUrl: 'https://otro.sitio/x.pdf' });
    expect(r4.statusCode).toBe(400);
    expect(await ctx.prisma.solicitudOptica.count()).toBe(0);
  });

  it('la óptica envía la solicitud: queda PENDIENTE, recibe el email y se avisa al equipo; no se duplica', async () => {
    const res = await ctx.inject('POST', '/sitio/opticas/solicitudes', undefined, { ...solicitudBase, cuit: '30711111111', habilitacionUrl, habilitacionNombre: 'habilitacion.pdf' });
    expect(res.statusCode).toBe(201);
    solicitudId = res.json().id;
    const s = await ctx.prisma.solicitudOptica.findUniqueOrThrow({ where: { id: solicitudId } });
    expect(s).toMatchObject({ estado: 'PENDIENTE', cuit: '30-71111111-1', email: 'duenia@opticanorte.test', codigoPostal: '1638' });
    expect(s.aceptaTerminosEn).toBeInstanceOf(Date);

    const emails = await ctx.prisma.emailEnviado.findMany({ where: { tipo: { in: ['SOLICITUD_OPTICA_RECIBIDA', 'ADMIN_SOLICITUD_OPTICA'] } } });
    expect(emails.map((e) => e.tipo).sort()).toEqual(['ADMIN_SOLICITUD_OPTICA', 'SOLICITUD_OPTICA_RECIBIDA']);
    expect(emails.find((e) => e.tipo === 'SOLICITUD_OPTICA_RECIBIDA')?.para).toBe('duenia@opticanorte.test');

    const dup = await ctx.inject('POST', '/sitio/opticas/solicitudes', undefined, { ...solicitudBase, habilitacionUrl });
    expect(dup.statusCode).toBe(409);

    const lista = (await ctx.inject('GET', '/admin/opticas/solicitudes?estado=PENDIENTE', ctx.staffCookie)).json();
    expect(lista.total).toBe(1);
    expect(lista.resumen).toEqual({ PENDIENTE: 1 });
    expect((await ctx.inject('GET', '/admin/opticas/solicitudes', ctx.clienteCookie)).statusCode).toBe(403);
  });

  let loginCookies: Cookies = {};
  let password = '';
  let opticaId = '';

  function cookiesDe(res: Awaited<ReturnType<Contexto['inject']>>): Cookies {
    const out: Cookies = {};
    for (const c of res.cookies) out[c.name] = c.value;
    return out;
  }

  it('el admin aprueba: se crea la óptica y su usuario dueño con contraseña provisoria y llega el email', async () => {
    const det = (await ctx.inject('GET', `/admin/opticas/solicitudes/${solicitudId}`, ctx.staffCookie)).json();
    expect(det.coincidencias).toEqual([]);
    expect(det.usuarioExistente).toBeNull();

    const res = await ctx.inject('POST', `/admin/opticas/solicitudes/${solicitudId}/aprobar`, ctx.staffCookie, { comisionPct: 12, radioKm: 8 });
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.solicitud.estado).toBe('APROBADA');
    expect(r.optica.creada).toBe(true);
    expect(r.usuario).toMatchObject({ email: 'duenia@opticanorte.test', creado: true });
    password = r.passwordProvisoria;
    opticaId = r.optica.id;
    expect(password).toMatch(/^[A-Z][a-z]{3}-\d{4}-[A-Z][a-z]$/);

    const o = await ctx.prisma.optica.findUniqueOrThrow({ where: { id: opticaId } });
    expect(o).toMatchObject({ nombre: 'Óptica Norte', razonSocial: 'Óptica Norte SRL', cuit: '30-71111111-1', condicionIva: 'RESPONSABLE_INSCRIPTO', matricula: 'MN 4521', radioKm: 8, activa: true });
    expect(o.habilitacionUrl).toBe(habilitacionUrl);
    expect(Number(o.comisionPct)).toBe(12);
    const u = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'duenia@opticanorte.test' } });
    expect(u).toMatchObject({ rol: 'OPTICA', opticaId, opticaDueno: true, debeCambiarPassword: true, activo: true });

    const email = await ctx.prisma.emailEnviado.findFirst({ where: { tipo: 'SOLICITUD_OPTICA_APROBADA' } });
    expect(email?.para).toBe('duenia@opticanorte.test');
    expect(email?.asunto).toContain('Óptica Norte');

    const otra = await ctx.inject('POST', `/admin/opticas/solicitudes/${solicitudId}/aprobar`, ctx.staffCookie, {});
    expect(otra.statusCode).toBe(409);
  });

  it('el usuario entra con la provisoria, sólo puede cambiarla, y después usa el panel', async () => {
    const login = await ctx.inject('POST', '/auth/login', undefined, { email: 'duenia@opticanorte.test', password });
    expect(login.statusCode).toBe(200);
    expect(login.json().user).toMatchObject({ rol: 'OPTICA', opticaId, debeCambiarPassword: true, opticaDueno: true });
    loginCookies = cookiesDe(login);

    const me = await ctx.inject('GET', '/optica/me', loginCookies);
    expect(me.statusCode).toBe(200);
    expect(me.json().usuario).toMatchObject({ dueno: true, debeCambiarPassword: true });

    const bloqueado = await ctx.inject('GET', '/optica/pedidos', loginCookies);
    expect(bloqueado.statusCode).toBe(403);
    expect(bloqueado.json().error.code).toBe('CAMBIAR_PASSWORD');

    const mal = await ctx.inject('POST', '/optica/password', loginCookies, { actual: 'otra-cosa', nueva: 'NuevaClave2026' });
    expect(mal.statusCode).toBe(400);
    const igual = await ctx.inject('POST', '/optica/password', loginCookies, { actual: password, nueva: password });
    expect(igual.statusCode).toBe(400);
    const corta = await ctx.inject('POST', '/optica/password', loginCookies, { actual: password, nueva: 'corta' });
    expect(corta.statusCode).toBe(400);
    const ok = await ctx.inject('POST', '/optica/password', loginCookies, { actual: password, nueva: 'NuevaClave2026' });
    expect(ok.statusCode).toBe(204);

    expect((await ctx.inject('GET', '/optica/pedidos', loginCookies)).statusCode).toBe(200);
    expect((await ctx.inject('POST', '/auth/login', undefined, { email: 'duenia@opticanorte.test', password })).statusCode).toBe(401);
    const relogin = await ctx.inject('POST', '/auth/login', undefined, { email: 'duenia@opticanorte.test', password: 'NuevaClave2026' });
    expect(relogin.statusCode).toBe(200);
    expect(relogin.json().user.debeCambiarPassword).toBe(false);
  });

  it('el dueño da de alta usuarios de su equipo; un usuario que no es dueño no puede', async () => {
    const alta = await ctx.inject('POST', '/optica/usuarios', loginCookies, { nombre: 'Pablo Ríos', email: 'pablo@opticanorte.test' });
    expect(alta.statusCode).toBe(201);
    const provisoria = alta.json().passwordProvisoria as string;
    expect(alta.json().usuario).toMatchObject({ email: 'pablo@opticanorte.test', opticaDueno: false, debeCambiarPassword: true, activo: true });
    expect(await ctx.prisma.emailEnviado.count({ where: { tipo: 'OPTICA_USUARIO_NUEVO', para: 'pablo@opticanorte.test' } })).toBe(1);

    const dup = await ctx.inject('POST', '/optica/usuarios', loginCookies, { nombre: 'Otro', email: 'pablo@opticanorte.test' });
    expect(dup.statusCode).toBe(409);

    const lista = (await ctx.inject('GET', '/optica/usuarios', loginCookies)).json();
    expect(lista.puedeAdministrar).toBe(true);
    expect(lista.items.map((u: { email: string }) => u.email)).toEqual(['duenia@opticanorte.test', 'pablo@opticanorte.test']);

    const pablo = cookiesDe(await ctx.inject('POST', '/auth/login', undefined, { email: 'pablo@opticanorte.test', password: provisoria }));
    expect((await ctx.inject('POST', '/optica/password', pablo, { actual: provisoria, nueva: 'ClaveDePablo1' })).statusCode).toBe(204);
    const noDueno = await ctx.inject('POST', '/optica/usuarios', pablo, { nombre: 'Intruso', email: 'intruso@opticanorte.test' });
    expect(noDueno.statusCode).toBe(403);
    expect((await ctx.inject('GET', '/optica/usuarios', pablo)).json().puedeAdministrar).toBe(false);

    // Desactivar: el usuario ya no entra. No puede desactivarse a sí mismo ni a usuarios de otra óptica.
    const pabloId = alta.json().usuario.id;
    expect((await ctx.inject('POST', `/optica/usuarios/${pabloId}/desactivar`, loginCookies)).statusCode).toBe(200);
    expect((await ctx.inject('POST', '/auth/login', undefined, { email: 'pablo@opticanorte.test', password: 'ClaveDePablo1' })).statusCode).toBe(401);
    const yo = (await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'duenia@opticanorte.test' } })).id;
    expect((await ctx.inject('POST', `/optica/usuarios/${yo}/desactivar`, loginCookies)).statusCode).toBe(400);
    expect((await ctx.inject('POST', `/optica/usuarios/${ctx.ids.admin}/desactivar`, loginCookies)).statusCode).toBe(404);
  });

  it('el admin rechaza una solicitud con motivo y sale el email; un email de cliente existente no se puede aprobar', async () => {
    const res = await ctx.inject('POST', '/sitio/opticas/solicitudes', undefined, {
      ...solicitudBase,
      nombreComercial: 'Óptica Sur',
      razonSocial: 'Sur SA',
      cuit: '20-12345678-6',
      condicionIva: 'MONOTRIBUTO',
      email: 'cli@p6.vedere',
      habilitacionUrl,
    });
    expect(res.statusCode).toBe(201);
    const id = res.json().id;

    const aprobar = await ctx.inject('POST', `/admin/opticas/solicitudes/${id}/aprobar`, ctx.staffCookie, {});
    expect(aprobar.statusCode).toBe(409);
    expect(aprobar.json().error.message).toContain('cuenta de cliente');

    const sinMotivo = await ctx.inject('POST', `/admin/opticas/solicitudes/${id}/rechazar`, ctx.staffCookie, { motivo: '' });
    expect(sinMotivo.statusCode).toBe(400);
    const rech = await ctx.inject('POST', `/admin/opticas/solicitudes/${id}/rechazar`, ctx.staffCookie, { motivo: 'La habilitación está vencida' });
    expect(rech.statusCode).toBe(200);
    expect(rech.json()).toMatchObject({ estado: 'RECHAZADA', motivoRechazo: 'La habilitación está vencida' });
    const email = await ctx.prisma.emailEnviado.findFirst({ where: { tipo: 'SOLICITUD_OPTICA_RECHAZADA' } });
    expect(email?.para).toBe('cli@p6.vedere');

    const lista = (await ctx.inject('GET', '/admin/opticas/solicitudes', ctx.staffCookie)).json();
    expect(lista.resumen).toEqual({ APROBADA: 1, RECHAZADA: 1 });
  });

  it('una solicitud nueva con el CUIT de una óptica existente se vincula a esa óptica', async () => {
    const res = await ctx.inject('POST', '/sitio/opticas/solicitudes', undefined, { ...solicitudBase, email: 'sucursal@opticanorte.test', habilitacionUrl });
    expect(res.statusCode).toBe(201);
    const det = (await ctx.inject('GET', `/admin/opticas/solicitudes/${res.json().id}`, ctx.staffCookie)).json();
    expect(det.coincidencias.map((o: { id: string }) => o.id)).toEqual([opticaId]);
    const ap = await ctx.inject('POST', `/admin/opticas/solicitudes/${res.json().id}/aprobar`, ctx.staffCookie, {});
    expect(ap.statusCode).toBe(200);
    expect(ap.json().optica).toMatchObject({ id: opticaId, creada: false });
    expect(await ctx.prisma.optica.count({ where: { cuit: '30-71111111-1' } })).toBe(1);
  });

  it('las plantillas nuevas aparecen en /admin/plantillas-email y se pueden editar', async () => {
    const res = await ctx.inject('GET', '/admin/plantillas-email', ctx.staffCookie);
    expect(res.statusCode).toBe(200);
    const tipos = (res.json().items as Array<{ tipo: string }>).map((p) => p.tipo);
    expect(tipos).toEqual(expect.arrayContaining(['SOLICITUD_OPTICA_RECIBIDA', 'SOLICITUD_OPTICA_APROBADA', 'SOLICITUD_OPTICA_RECHAZADA', 'OPTICA_USUARIO_NUEVO']));
    const put = await ctx.inject('PUT', '/admin/plantillas-email/SOLICITUD_OPTICA_RECIBIDA', ctx.staffCookie, {
      asunto: 'Gracias {{optica}}',
      titulo: 'Recibimos tu solicitud',
      cuerpo: 'Hola {{nombre}}, ya la estamos revisando.',
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().asunto).toBe('Gracias {{optica}}');
  });
});
