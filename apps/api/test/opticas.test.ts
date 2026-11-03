// Tests de integración del prompt 5 contra TEST_DATABASE_URL: asignación automática a la óptica más
// cercana (3 ópticas en CABA, pedido en Caballito), rechazo → siguiente óptica, plazo vencido, sin
// cobertura → aviso al admin, reasignación manual auditada, aislamiento del rol OPTICA (403), ciclo de
// estados con eventos y emails, turnos, liquidación mensual, solicitudes de cambio y exportación CSV.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@vedere/db';
import { testEnv } from './helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!hasDb)('ópticas socias y gestión de pedidos (integración)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let staffCookie: Record<string, string>;
  let clienteCookie: Record<string, string>;
  const cookieOptica: Record<string, Record<string, string>> = {};
  const opticas: Record<string, string> = {};
  let varianteSol = '';
  let varianteMulti = '';

  // Caballito (Av. Rivadavia 5000): Flores ~2,7 km (radio 6) · Palermo ~3,9 km (radio 8) · Belgrano ~6,5 km (radio 5, fuera).
  const direccionCaballito = {
    direccion: 'Av. Rivadavia 5000',
    localidad: 'Caballito',
    provincia: 'Buenos Aires',
    codigoPostal: '1424',
    lat: -34.6177,
    lng: -58.4367,
  };
  const datos = { email: 'caballito@test.vedere', nombre: 'Lucía Gómez', dni: '28999888', telefono: '+54 11 4444-5555' };

  const inject = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, cookies: Record<string, string>, payload?: unknown) =>
    app.inject({ method, url, cookies, ...(payload !== undefined ? { payload } : {}) });

  async function crearPedido(extra: Partial<{ opticaId: string; items: Array<{ varianteId: string; cantidad: number }>; modalidad: string; email: string }> = {}) {
    const res = await app.inject({
      method: 'POST',
      url: '/checkout/pedidos',
      payload: {
        datos: { ...datos, email: extra.email ?? datos.email },
        entrega: { modalidad: extra.modalidad ?? 'RETIRO_OPTICA', opticaId: extra.opticaId ?? opticas.belgrano, direccion: direccionCaballito },
        pago: { metodo: 'TRANSFERENCIA' },
        items: extra.items ?? [{ varianteId: varianteSol, cantidad: 1 }],
        receta: extra.items?.some((i) => i.varianteId === varianteMulti) ? { modo: 'OPTICA' } : undefined,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().pedido as { id: string; numero: string; estado: string };
  }

  async function aprobar(id: string) {
    const res = await inject('POST', `/admin/pedidos/${id}/pago/aprobar`, staffCookie, { nota: 'transferencia vista' });
    expect(res.statusCode).toBe(200);
    return res.json() as { estado: string; entrega: { optica: { id: string; nombre: string } | null }; eventos: Array<{ tipo: string; nota: string | null }> };
  }

  beforeAll(async () => {
    const db = await import('@vedere/db');
    prisma = db.prisma;
    const { buildApp } = await import('../src/app.js');
    app = await buildApp({
      env: testEnv({ DATABASE_URL: process.env.TEST_DATABASE_URL!, STORAGE_DRIVER: 'local', ADMIN_NOTIFY_EMAIL: 'equipo@test.vedere' }),
      logger: false,
    });
    await app.ready();

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE emails_enviados, reembolsos, solicitudes_cambio, turnos, pedido_eventos, eventos_webhook, cupon_usos, reservas_stock, pagos, pedido_items, pedidos, recetas, promociones, creadores, config_tienda, avisos_stock, carritos, mensajes_contacto, suscripciones_newsletter, cupones, opticas, promo_mensajes, imagenes_variante, variantes, "_CategoriaToProducto", productos, categorias, marcas, colecciones, refresh_tokens, users RESTART IDENTITY CASCADE',
    );
    await prisma.$executeRawUnsafe('ALTER SEQUENCE pedidos_numero_seq RESTART WITH 20001');

    const admin = await prisma.user.create({ data: { email: 'admin@opticas.vedere', nombre: 'Admin', rol: 'ADMIN', passwordHash: 'x' } });
    const cliente = await prisma.user.create({ data: { email: 'cli@opticas.vedere', nombre: 'Cliente', rol: 'CLIENTE', passwordHash: 'x' } });
    staffCookie = { vedere_access: app.jwt.sign({ sub: admin.id, email: admin.email, rol: 'ADMIN', nombre: 'Admin Vedere' }) };
    clienteCookie = { vedere_access: app.jwt.sign({ sub: cliente.id, email: cliente.email, rol: 'CLIENTE' }) };

    const base = { provincia: 'Buenos Aires', activa: true, comisionPct: 10, capacidadDiaria: 20 };
    const defs = [
      { key: 'palermo', nombre: 'Óptica Palermo', slug: 'optica-palermo', direccion: 'Av. Santa Fe 4120', localidad: 'Palermo', codigoPostal: '1425', lat: -34.5846, lng: -58.4216, radioKm: 8, email: 'palermo@test.vedere' },
      { key: 'flores', nombre: 'Óptica Flores', slug: 'optica-flores', direccion: 'Av. Rivadavia 6900', localidad: 'Flores', codigoPostal: '1406', lat: -34.6281, lng: -58.4636, radioKm: 6, email: 'flores@test.vedere', comisionPct: 12 },
      { key: 'belgrano', nombre: 'Óptica Belgrano', slug: 'optica-belgrano', direccion: 'Av. Cabildo 2240', localidad: 'Belgrano', codigoPostal: '1428', lat: -34.5615, lng: -58.4567, radioKm: 5, email: 'belgrano@test.vedere' },
    ];
    for (const { key, ...d } of defs) {
      const o = await prisma.optica.create({ data: { ...base, ...d } });
      opticas[key] = o.id;
      // Usuario OPTICA vinculado (vía API del admin, como lo haría el backoffice).
      const u = await inject('POST', '/admin/usuarios', staffCookie, {
        email: `${key}-user@test.vedere`,
        nombre: `Usuario ${d.nombre}`,
        rol: 'OPTICA',
        opticaId: o.id,
        password: 'clave-segura-123',
      });
      expect(u.statusCode).toBe(201);
      expect(u.json()).toMatchObject({ rol: 'OPTICA', opticaId: o.id, optica: { id: o.id } });
      cookieOptica[key] = { vedere_access: app.jwt.sign({ sub: u.json().id, email: u.json().email, rol: 'OPTICA', nombre: u.json().nombre, opticaId: o.id }) };
    }

    const sol = await prisma.producto.create({
      data: { nombre: 'Sol Test', slug: 'sol-test', linea: 'SOL', precio: 100000, estado: 'PUBLICADO', publicadoEn: new Date(), variantes: { create: [{ sku: 'OP-SOL', colorArmazon: 'Negro', stock: 50 }] } },
      include: { variantes: true },
    });
    varianteSol = sol.variantes[0]!.id;
    const multi = await prisma.producto.create({
      data: { nombre: 'Multi Test', slug: 'multi-test', linea: 'MULTIFOCAL', precio: 200000, estado: 'PUBLICADO', publicadoEn: new Date(), permiteReceta: true, variantes: { create: [{ sku: 'OP-MULTI', colorArmazon: 'Carey', stock: 50 }] } },
      include: { variantes: true },
    });
    varianteMulti = multi.variantes[0]!.id;
    await prisma.configTienda.create({ data: { id: 'default', descuentoTransferencia: 0, plazoAceptacionHoras: 4 } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('ABM de ópticas: campos nuevos, mapa y bloqueo de borrado con pedidos', async () => {
    const creada = await inject('POST', '/admin/opticas', staffCookie, {
      nombre: 'Óptica Temporal',
      razonSocial: 'Temporal S.R.L.',
      cuit: '30123456789',
      direccion: 'Calle Falsa 123',
      localidad: 'Almagro',
      provincia: 'Buenos Aires',
      codigoPostal: '1200',
      lat: -34.61,
      lng: -58.42,
      radioKm: 3,
      opticoResponsable: 'Dra. Ana López',
      matricula: 'MN 12345',
      comisionPct: 15,
      capacidadDiaria: 5,
      activa: false,
    });
    expect(creada.statusCode).toBe(201);
    expect(creada.json()).toMatchObject({ cuit: '30-12345678-9', radioKm: 3, comisionPct: 15, capacidadDiaria: 5, activa: false, matricula: 'MN 12345' });
    const mapa = await inject('GET', '/admin/opticas/mapa', staffCookie);
    expect(mapa.json().items.map((o: { id: string }) => o.id)).toContain(creada.json().id);
    const borrada = await inject('DELETE', `/admin/opticas/${creada.json().id}`, staffCookie);
    expect(borrada.statusCode).toBe(204);
  });

  it('con 3 ópticas en CABA, un pedido en Caballito se asigna a la más cercana dentro de su radio al aprobarse el pago', async () => {
    const pedido = await crearPedido({ opticaId: opticas.belgrano }); // preferencia del checkout: no manda
    expect(pedido.estado).toBe('PENDIENTE_PAGO');

    // Antes del pago, la óptica preferida NO lo ve (no está asignado).
    const antes = await inject('GET', `/optica/pedidos/${pedido.id}`, cookieOptica.belgrano!);
    expect(antes.statusCode).toBe(403);

    const aprobado = await aprobar(pedido.id);
    expect(aprobado.estado).toBe('ASIGNADO');
    expect(aprobado.entrega.optica?.id).toBe(opticas.flores);
    const tipos = aprobado.eventos.map((e) => e.tipo);
    expect(tipos).toEqual(expect.arrayContaining(['PAGO', 'ASIGNACION']));
    expect(aprobado.eventos.find((e) => e.tipo === 'ASIGNACION')?.nota).toContain('Óptica Flores');

    const db = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(db.aceptarAntesDe).not.toBeNull();
    expect(db.aceptarAntesDe!.getTime()).toBeGreaterThan(Date.now());
    expect(Number(db.comisionPct)).toBe(12);

    const emails = await prisma.emailEnviado.findMany({ where: { pedidoId: pedido.id }, orderBy: { createdAt: 'asc' } });
    // Prompt 6: PEDIDO_CONFIRMADO sale al crear el pedido.
    expect(emails.map((e) => e.tipo)).toEqual(['PEDIDO_CONFIRMADO', 'ESTADO_PAGADO', 'ESTADO_ASIGNADO', 'OPTICA_NUEVO_PEDIDO']);
    expect(emails.every((e) => e.estado === 'SIMULADO')).toBe(true); // sin RESEND_API_KEY
    expect(emails[3]!.para).toBe('flores@test.vedere');
  });

  it('la capacidad diaria desvía el pedido a la siguiente óptica más cercana', async () => {
    await prisma.optica.update({ where: { id: opticas.flores! }, data: { capacidadDiaria: 1 } }); // ya tiene 1 asignado hoy
    const pedido = await crearPedido();
    const aprobado = await aprobar(pedido.id);
    expect(aprobado.entrega.optica?.id).toBe(opticas.palermo);
    await prisma.optica.update({ where: { id: opticas.flores! }, data: { capacidadDiaria: 20 } });
    await inject('POST', `/admin/pedidos/${pedido.id}/cancelar`, staffCookie, { motivo: 'limpieza del test' });
  });

  it('un usuario OPTICA no ve pedidos de otra óptica, ni por URL ni por API (403)', async () => {
    const pedido = await prisma.pedido.findFirstOrThrow({ where: { opticaId: opticas.flores, estado: 'ASIGNADO' } });

    const propio = await inject('GET', `/optica/pedidos/${pedido.id}`, cookieOptica.flores!);
    expect(propio.statusCode).toBe(200);
    expect(propio.json()).toMatchObject({ numero: pedido.numero, cliente: { dni: datos.dni }, comision: { porcentaje: 12 } });

    const ajeno = await inject('GET', `/optica/pedidos/${pedido.id}`, cookieOptica.palermo!);
    expect(ajeno.statusCode).toBe(403);
    expect(ajeno.json().error.code).toBe('FORBIDDEN');

    for (const url of [`/optica/pedidos/${pedido.id}/aceptar`, `/optica/pedidos/${pedido.id}/rechazar`, `/optica/pedidos/${pedido.id}/estado`]) {
      const r = await inject('POST', url, cookieOptica.palermo!, { motivo: 'no es mío', estado: 'EN_ARMADO' });
      expect(r.statusCode).toBe(403);
    }
    const lista = await inject('GET', '/optica/pedidos', cookieOptica.palermo!);
    expect(lista.json().items.map((p: { id: string }) => p.id)).not.toContain(pedido.id);
    const listaFlores = await inject('GET', '/optica/pedidos?estado=ASIGNADO', cookieOptica.flores!);
    expect(listaFlores.json().items.map((p: { id: string }) => p.id)).toContain(pedido.id);

    // Otros roles no entran al panel; la óptica no entra al admin.
    expect((await inject('GET', '/optica/me', clienteCookie)).statusCode).toBe(403);
    expect((await inject('GET', '/optica/me', staffCookie)).statusCode).toBe(403);
    expect((await inject('GET', '/admin/pedidos', cookieOptica.flores!)).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/optica/me' })).statusCode).toBe(401);
    // Turnos sobre pedidos ajenos tampoco.
    const turnoAjeno = await inject('POST', '/optica/turnos', cookieOptica.palermo!, { pedidoId: pedido.id, fecha: new Date().toISOString(), clienteNombre: datos.nombre });
    expect(turnoAjeno.statusCode).toBe(403);
  });

  it('si la óptica rechaza, el pedido pasa a la siguiente y el admin lo ve en la línea de tiempo; sin cobertura queda sin asignar y se avisa', async () => {
    const pedido = await prisma.pedido.findFirstOrThrow({ where: { opticaId: opticas.flores, estado: 'ASIGNADO' } });

    const rechazo = await inject('POST', `/optica/pedidos/${pedido.id}/rechazar`, cookieOptica.flores!, { motivo: 'Sin stock de lentes esta semana' });
    expect(rechazo.statusCode).toBe(200);
    expect(rechazo.json().reasignado).toBe(true);

    let detalle = await inject('GET', `/admin/pedidos/${pedido.id}`, staffCookie);
    expect(detalle.json().estado).toBe('ASIGNADO');
    expect(detalle.json().entrega.optica.id).toBe(opticas.palermo);
    expect(detalle.json().opticasExcluidas).toEqual([opticas.flores]);
    const ev = detalle.json().eventos as Array<{ tipo: string; nota: string; optica: { nombre: string } | null; actor: { rol: string | null } }>;
    const rechazoEv = ev.find((e) => e.tipo === 'RECHAZO');
    expect(rechazoEv).toMatchObject({ optica: { nombre: 'Óptica Flores' }, actor: { rol: 'OPTICA' } });
    expect(rechazoEv!.nota).toContain('Sin stock de lentes esta semana');
    expect(ev.filter((e) => e.tipo === 'ASIGNACION').at(-1)!.nota).toContain('Óptica Palermo');
    // Flores ya no lo ve; Palermo sí.
    expect((await inject('GET', `/optica/pedidos/${pedido.id}`, cookieOptica.flores!)).statusCode).toBe(403);
    expect((await inject('GET', `/optica/pedidos/${pedido.id}`, cookieOptica.palermo!)).statusCode).toBe(200);

    // Palermo también rechaza: Belgrano está fuera de radio → sin asignar + aviso al admin.
    const r2 = await inject('POST', `/optica/pedidos/${pedido.id}/rechazar`, cookieOptica.palermo!, { motivo: 'Cerramos por vacaciones' });
    expect(r2.json().reasignado).toBe(false);
    detalle = await inject('GET', `/admin/pedidos/${pedido.id}`, staffCookie);
    expect(detalle.json()).toMatchObject({ estado: 'PAGADO', entrega: { optica: null } });
    expect((detalle.json().eventos as Array<{ tipo: string; nota: string }>).at(-1)!.nota).toContain('Sin asignar');
    const aviso = await prisma.emailEnviado.findFirst({ where: { pedidoId: pedido.id, tipo: 'ADMIN_SIN_ASIGNAR' } });
    expect(aviso?.para).toBe('equipo@test.vedere');
    const lista = await inject('GET', '/admin/pedidos?opticaId=sin', staffCookie);
    expect(lista.json().items.map((p: { id: string }) => p.id)).toContain(pedido.id);
    expect(lista.json().resumen.sinAsignar).toBeGreaterThanOrEqual(1);
    // Candidatas para reasignar a mano: ninguna elegible, Belgrano fuera de radio.
    const cand = detalle.json().candidatas as Array<{ id: string; elegible: boolean; dentroRadio: boolean; excluida: boolean }>;
    expect(cand.find((c) => c.id === opticas.belgrano)).toMatchObject({ elegible: false, dentroRadio: false });
    expect(cand.find((c) => c.id === opticas.flores)).toMatchObject({ excluida: true });
  });

  it('el admin reasigna a mano y queda registrado quién y por qué; la óptica acepta y recorre los estados con auditoría y emails', async () => {
    const pedido = await prisma.pedido.findFirstOrThrow({ where: { estado: 'PAGADO', opticaId: null } });

    const sinMotivo = await inject('POST', `/admin/pedidos/${pedido.id}/asignar`, staffCookie, { opticaId: opticas.belgrano });
    expect(sinMotivo.statusCode).toBe(400);
    const asignado = await inject('POST', `/admin/pedidos/${pedido.id}/asignar`, staffCookie, { opticaId: opticas.belgrano, motivo: 'Cliente pidió retirar cerca del trabajo' });
    expect(asignado.statusCode).toBe(200);
    expect(asignado.json()).toMatchObject({ estado: 'ASIGNADO', entrega: { optica: { id: opticas.belgrano } } });
    const evAsig = (asignado.json().eventos as Array<{ tipo: string; nota: string; actor: { nombre: string; rol: string }; datos: { manual?: boolean } }>).at(-1)!;
    expect(evAsig).toMatchObject({ tipo: 'ASIGNACION', nota: 'Cliente pidió retirar cerca del trabajo', actor: { nombre: 'Admin Vedere', rol: 'ADMIN' }, datos: { manual: true } });

    // Acciones de la óptica: aceptar → en armado → listo → entregado. ENVIADO no aplica a retiro.
    const b = cookieOptica.belgrano!;
    const acepta = await inject('POST', `/optica/pedidos/${pedido.id}/aceptar`, b);
    expect(acepta.json().estado).toBe('ACEPTADO');
    expect((await inject('POST', `/optica/pedidos/${pedido.id}/estado`, b, { estado: 'ENVIADO', numeroSeguimiento: 'X' })).statusCode).toBe(400);
    expect((await inject('POST', `/optica/pedidos/${pedido.id}/estado`, b, { estado: 'ENTREGADO' })).statusCode).toBe(409); // ACEPTADO → ENTREGADO no vale
    for (const estado of ['EN_ARMADO', 'LISTO', 'ENTREGADO'] as const) {
      const r = await inject('POST', `/optica/pedidos/${pedido.id}/estado`, b, { estado, nota: `paso ${estado}` });
      expect(r.statusCode).toBe(200);
      expect(r.json().estado).toBe(estado);
    }
    expect((await inject('POST', `/optica/pedidos/${pedido.id}/estado`, b, { estado: 'EN_ARMADO' })).statusCode).toBe(409);

    const detalle = await inject('GET', `/admin/pedidos/${pedido.id}`, staffCookie);
    const eventos = detalle.json().eventos as Array<{ tipo: string; estadoNuevo: string | null; actor: { rol: string | null } }>;
    const cambios = eventos.filter((e) => e.tipo === 'ESTADO').map((e) => e.estadoNuevo);
    expect(cambios).toEqual(['ACEPTADO', 'EN_ARMADO', 'LISTO', 'ENTREGADO']);
    expect(eventos.filter((e) => e.tipo === 'ESTADO').every((e) => e.actor.rol === 'OPTICA')).toBe(true);
    expect(detalle.json().comision).toEqual({ porcentaje: 10, monto: 10000 });
    expect(detalle.json().entregadoEn).not.toBeNull();

    // Cada cambio de estado disparó su email al cliente.
    const emails = await prisma.emailEnviado.findMany({ where: { pedidoId: pedido.id }, orderBy: { createdAt: 'asc' } });
    const tipos = emails.map((e) => e.tipo);
    for (const t of ['ESTADO_PAGADO', 'ESTADO_ASIGNADO', 'ESTADO_ACEPTADO', 'ESTADO_EN_ARMADO', 'ESTADO_LISTO', 'ESTADO_ENTREGADO']) {
      expect(tipos).toContain(t);
    }
    expect(emails.filter((e) => e.tipo === 'ESTADO_ASIGNADO')).toHaveLength(3); // Flores, Palermo y Belgrano
    expect(emails.filter((e) => e.tipo === 'OPTICA_NUEVO_PEDIDO').map((e) => e.para)).toEqual(['flores@test.vedere', 'palermo@test.vedere', 'belgrano@test.vedere']);

    // Reenvío manual del email del estado actual.
    const reenvio = await inject('POST', `/admin/pedidos/${pedido.id}/emails/reenviar`, staffCookie, {});
    expect(reenvio.statusCode).toBe(200);
    expect(reenvio.json().email).toMatchObject({ estado: 'SIMULADO', para: datos.email });
    expect((reenvio.json().eventos as Array<{ tipo: string }>).at(-1)!.tipo).toBe('EMAIL');
  });

  it('envío a domicilio: ENVIADO exige número de seguimiento y queda en el pedido', async () => {
    const pedido = await crearPedido({ modalidad: 'ENVIO_DOMICILIO', email: 'envio@test.vedere' });
    const aprobado = await aprobar(pedido.id);
    expect(aprobado.entrega.optica?.id).toBe(opticas.flores);
    const f = cookieOptica.flores!;
    await inject('POST', `/optica/pedidos/${pedido.id}/aceptar`, f);
    await inject('POST', `/optica/pedidos/${pedido.id}/estado`, f, { estado: 'EN_ARMADO' });
    await inject('POST', `/optica/pedidos/${pedido.id}/estado`, f, { estado: 'LISTO' });
    expect((await inject('POST', `/optica/pedidos/${pedido.id}/estado`, f, { estado: 'ENVIADO' })).statusCode).toBe(400);
    const env = await inject('POST', `/optica/pedidos/${pedido.id}/estado`, f, { estado: 'ENVIADO', numeroSeguimiento: 'AR123456789' });
    expect(env.json()).toMatchObject({ estado: 'ENVIADO', numeroSeguimiento: 'AR123456789' });
    const ent = await inject('POST', `/optica/pedidos/${pedido.id}/estado`, f, { estado: 'ENTREGADO' });
    expect(ent.json().estado).toBe('ENTREGADO');
  });

  it('si la óptica no acepta en el plazo, el pedido pasa a la siguiente más cercana (plazo vencido)', async () => {
    const pedido = await crearPedido({ email: 'vencido@test.vedere' });
    const aprobado = await aprobar(pedido.id);
    expect(aprobado.entrega.optica?.id).toBe(opticas.flores);
    await prisma.pedido.update({ where: { id: pedido.id }, data: { aceptarAntesDe: new Date(Date.now() - 60_000) } });
    const { procesarVencidos } = await import('../src/lib/asignacion.js');
    expect(await procesarVencidos(app.env)).toBe(1);
    const detalle = await inject('GET', `/admin/pedidos/${pedido.id}`, staffCookie);
    expect(detalle.json()).toMatchObject({ estado: 'ASIGNADO', entrega: { optica: { id: opticas.palermo } } });
    const vencido = (detalle.json().eventos as Array<{ tipo: string; nota: string; datos: { vencido?: boolean }; actor: { nombre: string } }>).find((e) => e.tipo === 'RECHAZO');
    expect(vencido).toMatchObject({ datos: { vencido: true }, actor: { nombre: 'Sistema' } });
    expect(vencido!.nota).toContain('vencido');
    expect(await procesarVencidos(app.env)).toBe(0);
    await inject('POST', `/admin/pedidos/${pedido.id}/cancelar`, staffCookie, { motivo: 'limpieza del test' });
  });

  it('agenda de turnos de la óptica (medición / ajuste) sobre sus pedidos', async () => {
    const pedido = await crearPedido({ items: [{ varianteId: varianteMulti, cantidad: 1 }], email: 'multi@test.vedere' });
    const aprobado = await aprobar(pedido.id);
    const key = aprobado.entrega.optica!.id === opticas.flores ? 'flores' : 'palermo';
    const c = cookieOptica[key]!;
    const fecha = new Date(Date.now() + 86400_000).toISOString();
    const creado = await inject('POST', '/optica/turnos', c, { pedidoId: pedido.id, tipo: 'MEDICION', fecha, clienteNombre: datos.nombre, clienteTelefono: datos.telefono, duracionMin: 45 });
    expect(creado.statusCode).toBe(201);
    expect(creado.json()).toMatchObject({ tipo: 'MEDICION', estado: 'PROGRAMADO', duracionMin: 45, pedido: { numero: pedido.numero } });
    const lista = await inject('GET', '/optica/turnos', c);
    expect(lista.json().items.map((t: { id: string }) => t.id)).toContain(creado.json().id);
    const otra = await inject('GET', '/optica/turnos', cookieOptica[key === 'flores' ? 'palermo' : 'flores']!);
    expect(otra.json().items.map((t: { id: string }) => t.id)).not.toContain(creado.json().id);
    const upd = await inject('PUT', `/optica/turnos/${creado.json().id}`, c, { estado: 'REALIZADO', tipo: 'AJUSTE' });
    expect(upd.json()).toMatchObject({ estado: 'REALIZADO', tipo: 'AJUSTE' });
    const detalle = await inject('GET', `/optica/pedidos/${pedido.id}`, c);
    expect(detalle.json().turnos).toHaveLength(1);
    expect(detalle.json().receta.modo).toBe('OPTICA');
    await inject('POST', `/admin/pedidos/${pedido.id}/cancelar`, staffCookie, { motivo: 'limpieza del test' });
  });

  it('la liquidación mensual coincide con la suma de los pedidos entregados por cada óptica', async () => {
    const mes = new Date().toISOString().slice(0, 7);
    const entregados = await prisma.pedido.findMany({ where: { estado: 'ENTREGADO' }, select: { opticaId: true, total: true, comisionMonto: true } });
    expect(entregados.length).toBeGreaterThanOrEqual(2);
    const esperado = new Map<string, { n: number; monto: number; comision: number }>();
    for (const p of entregados) {
      const acc = esperado.get(p.opticaId!) ?? { n: 0, monto: 0, comision: 0 };
      acc.n += 1;
      acc.monto += Number(p.total);
      acc.comision += Number(p.comisionMonto);
      esperado.set(p.opticaId!, acc);
    }
    for (const key of ['belgrano', 'flores'] as const) {
      const liq = await inject('GET', `/optica/liquidacion?mes=${mes}`, cookieOptica[key]!);
      expect(liq.statusCode).toBe(200);
      const e = esperado.get(opticas[key]!)!;
      expect(liq.json()).toMatchObject({ mes, cantidad: e.n, monto: e.monto, comision: e.comision });
      expect(liq.json().pedidos).toHaveLength(e.n);
    }
    const general = await inject('GET', `/admin/liquidaciones?mes=${mes}`, staffCookie);
    const fila = (general.json().items as Array<{ optica: { id: string }; cantidad: number; monto: number; comision: number }>).find((i) => i.optica.id === opticas.belgrano)!;
    expect(fila).toMatchObject({ cantidad: esperado.get(opticas.belgrano!)!.n, comision: esperado.get(opticas.belgrano!)!.comision });
    expect(general.json().totales.monto).toBe([...esperado.values()].reduce((a, e) => a + e.monto, 0));
    const vacio = await inject('GET', `/optica/liquidacion?mes=2020-01`, cookieOptica.palermo!);
    expect(vacio.json()).toMatchObject({ cantidad: 0, monto: 0, comision: 0 });
  });

  it('cambios y devoluciones: el cliente solicita, el admin aprueba con reintegro y el pedido queda DEVUELTO', async () => {
    const pedido = await prisma.pedido.findFirstOrThrow({ where: { estado: 'ENTREGADO', email: datos.email } });
    const noDuenio = await app.inject({ method: 'POST', url: `/checkout/pedidos/${pedido.id}/solicitudes`, payload: { tipo: 'CAMBIO', motivo: 'No me gusta', email: 'otro@test.vedere' } });
    expect(noDuenio.statusCode).toBe(403);
    const sol = await app.inject({
      method: 'POST',
      url: `/checkout/pedidos/${pedido.id}/solicitudes`,
      payload: { tipo: 'DEVOLUCION', motivo: 'Me quedan grandes', detalle: 'Probé el ajuste y no funciona', email: datos.email },
    });
    expect(sol.statusCode).toBe(201);
    expect(sol.json().solicitud).toMatchObject({ tipo: 'DEVOLUCION', estado: 'PENDIENTE' });
    const repetida = await app.inject({ method: 'POST', url: `/checkout/pedidos/${pedido.id}/solicitudes`, payload: { tipo: 'CAMBIO', motivo: 'Otra solicitud', email: datos.email } });
    expect(repetida.statusCode).toBe(409);

    const bandeja = await inject('GET', '/admin/solicitudes?estado=PENDIENTE', staffCookie);
    expect(bandeja.json().pendientes).toBe(1);
    expect(bandeja.json().items[0]).toMatchObject({ id: sol.json().solicitud.id, pedido: { numero: pedido.numero } });

    const stockAntes = (await prisma.variante.findUniqueOrThrow({ where: { id: varianteSol } })).stock;
    const ok = await inject('POST', `/admin/solicitudes/${sol.json().solicitud.id}/aprobar`, staffCookie, { resolucion: 'REINTEGRO', respuesta: 'Te devolvemos el importe' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().solicitud).toMatchObject({ estado: 'APROBADA', resolucion: 'REINTEGRO' });
    expect(ok.json().pedido).toMatchObject({ estado: 'DEVUELTO', estadoPago: 'REEMBOLSADO', reembolsado: Number(pedido.total) });
    expect(ok.json().pedido.reembolsos[0]).toMatchObject({ proveedor: 'manual', monto: Number(pedido.total) });
    expect((await prisma.variante.findUniqueOrThrow({ where: { id: varianteSol } })).stock).toBe(stockAntes); // entregado: no repone stock
    const tipos = (await prisma.emailEnviado.findMany({ where: { pedidoId: pedido.id } })).map((e) => e.tipo);
    expect(tipos).toEqual(expect.arrayContaining(['SOLICITUD_PENDIENTE', 'ADMIN_SOLICITUD', 'REEMBOLSO', 'SOLICITUD_APROBADA', 'ESTADO_DEVUELTO']));
    const deNuevo = await inject('POST', `/admin/solicitudes/${sol.json().solicitud.id}/aprobar`, staffCookie, { resolucion: 'REINTEGRO' });
    expect(deNuevo.statusCode).toBe(409);
  });

  it('cambio aprobado con pedido nuevo sin cargo: clona los ítems, descuenta stock y asigna', async () => {
    const pedido = await prisma.pedido.findFirstOrThrow({ where: { estado: 'ENTREGADO', email: 'envio@test.vedere' } });
    const sol = await app.inject({ method: 'POST', url: `/checkout/pedidos/${pedido.id}/solicitudes`, payload: { tipo: 'CAMBIO', motivo: 'Quiero otro color', email: 'envio@test.vedere' } });
    expect(sol.statusCode).toBe(201);
    const stockAntes = (await prisma.variante.findUniqueOrThrow({ where: { id: varianteSol } })).stock;
    const ok = await inject('POST', `/admin/solicitudes/${sol.json().solicitud.id}/aprobar`, staffCookie, { resolucion: 'NUEVO_PEDIDO' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().nuevoPedido).toMatchObject({ estado: 'ASIGNADO', canal: 'ADMIN', totales: { total: 0 }, estadoPago: 'APROBADO' });
    expect(ok.json().nuevoPedido.items).toHaveLength(1);
    expect(ok.json().pedido.estado).toBe('DEVUELTO');
    expect((await prisma.variante.findUniqueOrThrow({ where: { id: varianteSol } })).stock).toBe(stockAntes - 1);
    const busq = await app.inject({ method: 'GET', url: `/checkout/pedidos/buscar?numero=${pedido.numero}&email=envio@test.vedere` });
    expect(busq.json().solicitudes[0]).toMatchObject({ estado: 'APROBADA', nuevoPedidoId: ok.json().nuevoPedido.id });
  });

  it('listado del admin: filtros por óptica, línea, canal, fecha y búsqueda por DNI; exportación CSV; notas internas', async () => {
    const porDni = await inject('GET', `/admin/pedidos?q=${datos.dni}`, staffCookie);
    expect(porDni.json().total).toBeGreaterThanOrEqual(1);
    expect(porDni.json().items.every((p: { cliente: { dni: string } }) => p.cliente.dni === datos.dni)).toBe(true);
    const porLinea = await inject('GET', '/admin/pedidos?linea=MULTIFOCAL', staffCookie);
    expect(porLinea.json().items.every((p: { lineas: string[] }) => p.lineas.includes('MULTIFOCAL'))).toBe(true);
    expect(porLinea.json().total).toBeGreaterThanOrEqual(1);
    const porCanal = await inject('GET', '/admin/pedidos?canal=ADMIN', staffCookie);
    expect(porCanal.json().total).toBe(1);
    const porOptica = await inject('GET', `/admin/pedidos?opticaId=${opticas.belgrano}&estado=DEVUELTO`, staffCookie);
    expect(porOptica.json().total).toBe(1);
    const hoy = new Date().toISOString().slice(0, 10);
    const porFecha = await inject('GET', `/admin/pedidos?desde=${hoy}&hasta=${hoy}`, staffCookie);
    expect(porFecha.json().total).toBe(await prisma.pedido.count());
    const vacio = await inject('GET', '/admin/pedidos?desde=2020-01-01&hasta=2020-01-31', staffCookie);
    expect(vacio.json().total).toBe(0);

    const csv = await inject('GET', `/admin/pedidos/export.csv?q=${datos.dni}`, staffCookie);
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body).toContain('numero;fecha;estado');
    expect(csv.body).toContain('VD-20001');

    const pedido = await prisma.pedido.findFirstOrThrow({ where: { estado: 'DEVUELTO' } });
    const nota = await inject('POST', `/admin/pedidos/${pedido.id}/notas`, staffCookie, { nota: 'Cliente llamó para confirmar el reintegro' });
    expect((nota.json().eventos as Array<{ tipo: string; nota: string; actor: { nombre: string } }>).at(-1)).toMatchObject({ tipo: 'NOTA', nota: 'Cliente llamó para confirmar el reintegro', actor: { nombre: 'Admin Vedere' } });
  });

  it('cancelación desde el admin devuelve el stock, audita y avisa al cliente', async () => {
    const pedido = await crearPedido({ email: 'cancelar@test.vedere' });
    await aprobar(pedido.id);
    const stockAntes = (await prisma.variante.findUniqueOrThrow({ where: { id: varianteSol } })).stock;
    const can = await inject('POST', `/admin/pedidos/${pedido.id}/cancelar`, staffCookie, { motivo: 'Cliente se arrepintió' });
    expect(can.json().estado).toBe('CANCELADO');
    expect((await prisma.variante.findUniqueOrThrow({ where: { id: varianteSol } })).stock).toBe(stockAntes + 1);
    const ev = (can.json().eventos as Array<{ tipo: string; estadoNuevo: string | null; nota: string; datos: { stockRepuesto?: boolean } }>).at(-1)!;
    expect(ev).toMatchObject({ tipo: 'ESTADO', estadoNuevo: 'CANCELADO', nota: 'Cliente se arrepintió', datos: { stockRepuesto: true } });
    expect(await prisma.emailEnviado.count({ where: { pedidoId: pedido.id, tipo: 'ESTADO_CANCELADO' } })).toBe(1);
    // La óptica ya no lo opera (sigue viéndolo como cancelado en su historial, pero no puede avanzarlo).
    const r = await inject('POST', `/optica/pedidos/${pedido.id}/aceptar`, cookieOptica.flores!);
    expect(r.statusCode).toBe(400);
  });
});
