// Panel de la óptica socia (rol OPTICA): sus pedidos asignados (nunca los de otra óptica → 403),
// aceptar / rechazar, avanzar estados, agenda de turnos y liquidación mensual.
import type { FastifyPluginAsync } from 'fastify';
import argon2 from 'argon2';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { actorDe, cambiarEstado, rechazarAsignacion } from '../lib/asignacion.js';
import { Errors } from '../lib/errors.js';
import { liquidacionOptica } from '../lib/liquidacion.js';
import { paginate, pageResponse, paginationQuery } from '../lib/pagination.js';
import { pedidoIncludeDetalle, serializePedido, serializeTurno } from '../lib/pedidos.js';
import { dec } from '../lib/serialize.js';
import { enviarPlantilla } from '../lib/plantillas.js';
import { hashPassword, passwordProvisoria } from '../lib/solicitudes-optica.js';
import { cambiarPasswordInput, usuarioOpticaInput } from '../schemas/b2b.js';
import { parse } from '../lib/validate.js';
import {
  liquidacionQuery,
  opticaEstadoInput,
  opticaPedidosQuery,
  rechazoInput,
  turnoInput,
  turnoUpdate,
  turnosQuery,
} from '../schemas/checkout.js';

const listQuery = paginationQuery.extend(opticaPedidosQuery.shape);

/** Estados en los que un pedido pertenece operativamente a la óptica. */
const ESTADOS_OPTICA = ['ASIGNADO', 'ACEPTADO', 'EN_ARMADO', 'LISTO', 'ENVIADO', 'ENTREGADO', 'DEVUELTO', 'CANCELADO'] as const;

const opticaRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.requireOptica);

  /** Carga el pedido y verifica que sea de esta óptica (si no, 403 aunque exista). */
  async function pedidoPropio(request: { params: { id: string }; optica?: { id: string } }) {
    const p = await prisma.pedido.findUnique({ where: { id: request.params.id }, include: pedidoIncludeDetalle });
    if (!p) throw Errors.notFound('Pedido no encontrado');
    if (p.opticaId !== request.optica!.id || !p.asignadoEn) throw Errors.forbidden('Este pedido pertenece a otra óptica');
    return p;
  }

  app.get('/me', { config: { permitirPasswordProvisoria: true } }, async (request) => {
    const o = request.optica!;
    const [pendientes, enCurso, hoy] = await Promise.all([
      prisma.pedido.count({ where: { opticaId: o.id, estado: 'ASIGNADO' } }),
      prisma.pedido.count({ where: { opticaId: o.id, estado: { in: ['ACEPTADO', 'EN_ARMADO', 'LISTO', 'ENVIADO'] } } }),
      prisma.turno.count({
        where: {
          opticaId: o.id,
          estado: 'PROGRAMADO',
          fecha: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lt: new Date(new Date().setHours(24, 0, 0, 0)) },
        },
      }),
    ]);
    return {
      usuario: {
        id: request.user.sub,
        email: request.user.email,
        nombre: request.user.nombre ?? null,
        dueno: request.opticaUsuario?.dueno ?? false,
        debeCambiarPassword: request.opticaUsuario?.debeCambiarPassword ?? false,
      },
      optica: {
        id: o.id,
        nombre: o.nombre,
        slug: o.slug,
        razonSocial: o.razonSocial,
        cuit: o.cuit,
        direccion: o.direccion,
        localidad: o.localidad,
        provincia: o.provincia,
        codigoPostal: o.codigoPostal,
        telefono: o.telefono,
        whatsapp: o.whatsapp,
        email: o.email,
        horarios: o.horarios,
        opticoResponsable: o.opticoResponsable,
        matricula: o.matricula,
        condicionIva: o.condicionIva,
        radioKm: o.radioKm,
        capacidadDiaria: o.capacidadDiaria,
        comisionPct: dec(o.comisionPct) ?? 0,
        activa: o.activa,
      },
      resumen: { pendientes, enCurso, turnosHoy: hoy },
    };
  });

  // ---------- Pedidos ----------

  app.get('/pedidos', async (request) => {
    const q = parse(listQuery, request.query);
    const hasta = q.hasta ? new Date(q.hasta.getTime() + 86400_000) : undefined;
    const where: Prisma.PedidoWhereInput = {
      opticaId: request.optica!.id,
      asignadoEn: { not: null },
      estado: q.estado ? q.estado : { in: [...ESTADOS_OPTICA] },
      ...(q.desde || hasta ? { asignadoEn: { not: null, ...(q.desde ? { gte: q.desde } : {}), ...(hasta ? { lt: hasta } : {}) } } : {}),
      ...(q.q
        ? {
            OR: [
              { numero: { contains: q.q.toUpperCase() } },
              { nombre: { contains: q.q, mode: 'insensitive' } },
              { email: { contains: q.q, mode: 'insensitive' } },
              { dni: { contains: q.q.replace(/\D/g, '') || q.q } },
            ],
          }
        : {}),
    };
    const [total, items, porEstado] = await Promise.all([
      prisma.pedido.count({ where }),
      prisma.pedido.findMany({
        where,
        orderBy: [{ asignadoEn: 'desc' }],
        ...paginate(q),
        include: { items: { select: { linea: true, cantidad: true, conReceta: true } }, _count: { select: { items: true, turnos: true } } },
      }),
      prisma.pedido.groupBy({ by: ['estado'], where: { opticaId: request.optica!.id, asignadoEn: { not: null } }, _count: { _all: true } }),
    ]);
    return {
      ...pageResponse(
        items.map((p) => ({
          id: p.id,
          numero: p.numero,
          estado: p.estado,
          modalidad: p.modalidad,
          cliente: { nombre: p.nombre, telefono: p.telefono },
          localidad: p.localidad,
          lineas: [...new Set(p.items.map((i) => i.linea))],
          conReceta: p.items.some((i) => i.conReceta),
          items: p._count.items,
          turnos: p._count.turnos,
          total: dec(p.total) ?? 0,
          asignadoEn: p.asignadoEn,
          aceptarAntesDe: p.aceptarAntesDe,
          aceptadoEn: p.aceptadoEn,
          entregadoEn: p.entregadoEn,
          createdAt: p.createdAt,
        })),
        total,
        q,
      ),
      resumen: Object.fromEntries(porEstado.map((r) => [r.estado, r._count._all])),
    };
  });

  app.get<{ Params: { id: string } }>('/pedidos/:id', async (request) => {
    const p = await pedidoPropio(request);
    return serializePedido(p, { optica: true });
  });

  app.post<{ Params: { id: string } }>('/pedidos/:id/aceptar', async (request) => {
    const p = await pedidoPropio(request);
    if (p.estado !== 'ASIGNADO') throw Errors.badRequest('El pedido ya no está pendiente de aceptación');
    await cambiarEstado(p.id, 'ACEPTADO', { env: app.env, actor: actorDe(request.user), nota: `Aceptado por ${request.optica!.nombre}` });
    return serializePedido(await prisma.pedido.findUniqueOrThrow({ where: { id: p.id }, include: pedidoIncludeDetalle }), { optica: true });
  });

  /** Rechazo con motivo: el pedido pasa a la siguiente óptica más cercana y deja de verse acá. */
  app.post<{ Params: { id: string } }>('/pedidos/:id/rechazar', async (request) => {
    const body = parse(rechazoInput, request.body);
    const p = await pedidoPropio(request);
    const r = await rechazarAsignacion(p.id, { env: app.env, actor: actorDe(request.user), opticaId: request.optica!.id, motivo: body.motivo });
    return { ok: true, numero: p.numero, reasignado: r.optica ? r.optica.id !== request.optica!.id : false };
  });

  /** EN_ARMADO → LISTO → ENVIADO (con seguimiento) → ENTREGADO (entregado y ajustado). */
  app.post<{ Params: { id: string } }>('/pedidos/:id/estado', async (request) => {
    const body = parse(opticaEstadoInput, request.body);
    const p = await pedidoPropio(request);
    if (body.estado === 'ENVIADO' && p.modalidad !== 'ENVIO_DOMICILIO') {
      throw Errors.badRequest('Este pedido se retira en la óptica: marcalo como listo para retirar y luego entregado');
    }
    if (body.estado === 'ENVIADO' && !body.numeroSeguimiento) {
      throw Errors.badRequest('Ingresá el número de seguimiento', [{ path: 'numeroSeguimiento', message: 'Obligatorio para marcar enviado' }]);
    }
    await cambiarEstado(p.id, body.estado, {
      env: app.env,
      actor: actorDe(request.user),
      nota: body.nota ?? null,
      numeroSeguimiento: body.numeroSeguimiento ?? undefined,
    });
    return serializePedido(await prisma.pedido.findUniqueOrThrow({ where: { id: p.id }, include: pedidoIncludeDetalle }), { optica: true });
  });

  // ---------- Agenda de turnos ----------

  const turnoInclude = { optica: { select: { id: true, nombre: true } }, pedido: { select: { id: true, numero: true, estado: true } } } satisfies Prisma.TurnoInclude;

  app.get('/turnos', async (request) => {
    const q = parse(turnosQuery, request.query);
    const turnos = await prisma.turno.findMany({
      where: {
        opticaId: request.optica!.id,
        ...(q.estado ? { estado: q.estado } : {}),
        ...(q.desde || q.hasta ? { fecha: { ...(q.desde ? { gte: q.desde } : {}), ...(q.hasta ? { lt: q.hasta } : {}) } } : {}),
      },
      orderBy: { fecha: 'asc' },
      take: 500,
      include: turnoInclude,
    });
    return { items: turnos.map((t) => ({ ...serializeTurno(t), pedido: t.pedido })) };
  });

  app.post('/turnos', async (request, reply) => {
    const body = parse(turnoInput, request.body);
    if (body.pedidoId) {
      const p = await prisma.pedido.findUnique({ where: { id: body.pedidoId }, select: { opticaId: true } });
      if (!p || p.opticaId !== request.optica!.id) throw Errors.forbidden('Ese pedido no es de tu óptica');
    }
    const t = await prisma.turno.create({
      data: { ...body, opticaId: request.optica!.id, createdById: request.user.sub },
      include: turnoInclude,
    });
    return reply.status(201).send({ ...serializeTurno(t), pedido: t.pedido });
  });

  app.put<{ Params: { id: string } }>('/turnos/:id', async (request) => {
    const body = parse(turnoUpdate, request.body);
    const existing = await prisma.turno.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Turno no encontrado');
    if (existing.opticaId !== request.optica!.id) throw Errors.forbidden('Ese turno es de otra óptica');
    if (body.pedidoId) {
      const p = await prisma.pedido.findUnique({ where: { id: body.pedidoId }, select: { opticaId: true } });
      if (!p || p.opticaId !== request.optica!.id) throw Errors.forbidden('Ese pedido no es de tu óptica');
    }
    const t = await prisma.turno.update({ where: { id: existing.id }, data: body, include: turnoInclude });
    return { ...serializeTurno(t), pedido: t.pedido };
  });

  app.delete<{ Params: { id: string } }>('/turnos/:id', async (request, reply) => {
    const existing = await prisma.turno.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Turno no encontrado');
    if (existing.opticaId !== request.optica!.id) throw Errors.forbidden('Ese turno es de otra óptica');
    await prisma.turno.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });

  // ---------- Liquidación ----------

  app.get('/liquidacion', async (request) => {
    const q = parse(liquidacionQuery.omit({ opticaId: true }), request.query);
    return liquidacionOptica(request.optica!.id, q.mes);
  });

  // ---------- Contraseña (B2B 1) ----------

  /** Cambio de contraseña; obligatorio con la provisoria (es lo único que se puede hacer antes). */
  app.post('/password', { config: { permitirPasswordProvisoria: true } }, async (request, reply) => {
    const body = parse(cambiarPasswordInput, request.body);
    const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) throw Errors.unauthorized();
    const ok = await argon2.verify(user.passwordHash, body.actual).catch(() => false);
    if (!ok) throw Errors.badRequest('La contraseña actual no es correcta', { campo: 'actual' });
    if (body.actual === body.nueva) throw Errors.badRequest('La contraseña nueva tiene que ser distinta de la actual', { campo: 'nueva' });
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.nueva), debeCambiarPassword: false },
    });
    return reply.status(204).send();
  });

  // ---------- Usuarios del equipo (B2B 1) ----------

  /** El dueño da de alta y administra a su equipo; el resto sólo ve la lista. */
  function exigirDueno(request: { opticaUsuario?: { dueno: boolean } }) {
    if (!request.opticaUsuario?.dueno) throw Errors.forbidden('Sólo el dueño de la óptica puede administrar usuarios');
  }

  const usuarioSelect = {
    id: true,
    nombre: true,
    email: true,
    telefono: true,
    activo: true,
    opticaDueno: true,
    debeCambiarPassword: true,
    createdAt: true,
  } as const;

  app.get('/usuarios', async (request) => {
    const items = await prisma.user.findMany({
      where: { opticaId: request.optica!.id, rol: 'OPTICA' },
      select: usuarioSelect,
      orderBy: [{ opticaDueno: 'desc' }, { nombre: 'asc' }],
    });
    return { items, puedeAdministrar: request.opticaUsuario?.dueno ?? false };
  });

  app.post('/usuarios', async (request, reply) => {
    exigirDueno(request);
    const body = parse(usuarioOpticaInput, request.body);
    const existe = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (existe) throw Errors.conflict('Ya existe un usuario con ese email');
    const password = passwordProvisoria();
    const user = await prisma.user.create({
      data: {
        email: body.email,
        nombre: body.nombre,
        telefono: body.telefono,
        rol: 'OPTICA',
        opticaId: request.optica!.id,
        opticaDueno: false,
        debeCambiarPassword: true,
        passwordHash: await hashPassword(password),
      },
      select: usuarioSelect,
    });
    const web = app.env.WEB_URL.replace(/\/$/, '');
    await enviarPlantilla(app.env, {
      tipo: 'OPTICA_USUARIO_NUEVO',
      para: user.email,
      vars: { nombre: user.nombre.split(' ')[0] || user.nombre, optica: request.optica!.nombre, email: user.email, password, url: `${web}/optica/login` },
      ctaHref: `${web}/optica/login`,
    });
    return reply.status(201).send({ usuario: user, passwordProvisoria: password });
  });

  /** Usuario del equipo de esta óptica (nunca el propio ni el de otra óptica). */
  async function usuarioDelEquipo(request: { params: { id: string }; optica?: { id: string }; user: { sub: string } }) {
    const u = await prisma.user.findUnique({ where: { id: request.params.id } });
    if (!u || u.opticaId !== request.optica!.id || u.rol !== 'OPTICA') throw Errors.notFound('Usuario no encontrado');
    if (u.id === request.user.sub) throw Errors.badRequest('No podés modificar tu propio usuario desde acá');
    return u;
  }

  app.post<{ Params: { id: string } }>('/usuarios/:id/desactivar', async (request) => {
    exigirDueno(request);
    const u = await usuarioDelEquipo(request);
    await prisma.$transaction([
      prisma.user.update({ where: { id: u.id }, data: { activo: false } }),
      prisma.refreshToken.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { id: u.id, activo: false };
  });

  app.post<{ Params: { id: string } }>('/usuarios/:id/activar', async (request) => {
    exigirDueno(request);
    const u = await usuarioDelEquipo(request);
    await prisma.user.update({ where: { id: u.id }, data: { activo: true } });
    return { id: u.id, activo: true };
  });

  /** Nueva contraseña provisoria (se muestra una vez y va por email). */
  app.post<{ Params: { id: string } }>('/usuarios/:id/password', async (request) => {
    exigirDueno(request);
    const u = await usuarioDelEquipo(request);
    const password = passwordProvisoria();
    await prisma.$transaction([
      prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(password), debeCambiarPassword: true } }),
      prisma.refreshToken.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    const web = app.env.WEB_URL.replace(/\/$/, '');
    await enviarPlantilla(app.env, {
      tipo: 'OPTICA_USUARIO_NUEVO',
      para: u.email,
      vars: { nombre: u.nombre.split(' ')[0] || u.nombre, optica: request.optica!.nombre, email: u.email, password, url: `${web}/optica/login` },
      ctaHref: `${web}/optica/login`,
    });
    return { id: u.id, passwordProvisoria: password };
  });
};

export default opticaRoutes;
