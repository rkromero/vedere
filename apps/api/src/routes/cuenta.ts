// Cuenta del cliente (prompt 6): datos personales, pedidos, recetas, direcciones, favoritos, referidos y
// Plan Rivedere. Todas las rutas exigen sesión (cualquier rol: el staff también puede comprar).
import { EN_TIENDA } from '../lib/canales.js';
import type { FastifyPluginAsync } from 'fastify';
import argon2 from 'argon2';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { calificacionInput, cambioPasswordInput, datosInput, direccionCuentaInput } from '../schemas/cuenta.js';
import {
  LINEAS_CON_RECETA,
  cargarConfig,
  pedidoInclude,
  pedidoIncludeDetalle,
  serializeEvento,
  serializePedido,
  serializeReceta,
  serializeTurno,
} from '../lib/pedidos.js';
import { dec, productoInclude, serializeProductoPublico } from '../lib/serialize.js';
import { asegurarCodigoReferido, cuponesDelCliente, linkReferido } from '../lib/referidos.js';
import { toPublicUser } from '../lib/tokens.js';

type DireccionRow = Prisma.DireccionGetPayload<Record<string, never>>;

function serializeDireccion(d: DireccionRow) {
  return {
    id: d.id,
    etiqueta: d.etiqueta,
    direccion: d.direccion,
    piso: d.piso,
    localidad: d.localidad,
    provincia: d.provincia,
    codigoPostal: d.codigoPostal,
    lat: d.lat,
    lng: d.lng,
    placeId: d.placeId,
    telefono: d.telefono,
    predeterminada: d.predeterminada,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

/** "Ana P." a partir de "Ana Pérez" (para la lista de referidos, sin exponer datos). */
function nombreAbreviado(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const primero = partes[0] ?? '';
  const apellido = partes.length > 1 ? ` ${partes[partes.length - 1]![0]!.toUpperCase()}.` : '';
  return `${primero}${apellido}`;
}

function sumarMeses(fecha: Date, meses: number): Date {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + meses);
  return d;
}

/** Eventos del pedido que ve el cliente (sin notas internas, rechazos de ópticas ni registro de emails). */
const EVENTOS_CLIENTE = ['ESTADO', 'ASIGNACION', 'PAGO', 'REEMBOLSO', 'SOLICITUD'] as const;

const cuentaRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  async function usuarioActual(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { optica: { select: { id: true, nombre: true, slug: true } } },
    });
    if (!user || !user.activo) throw Errors.unauthorized();
    return user;
  }

  function publico(user: Awaited<ReturnType<typeof usuarioActual>>) {
    return {
      ...toPublicUser(user),
      googleVinculado: !!user.googleId,
      tienePassword: !user.passwordHash.startsWith('!'),
      newsletter: user.newsletter,
      codigoReferido: user.codigoReferido,
    };
  }

  // ---------- Resumen ----------

  app.get('/', async (request) => {
    const user = await usuarioActual(request.user.sub);
    const [pedidos, recetas, direcciones, favoritos, cfg, ultimaRecetado] = await Promise.all([
      prisma.pedido.count({ where: { userId: user.id } }),
      prisma.receta.count({ where: { userId: user.id } }),
      prisma.direccion.count({ where: { userId: user.id } }),
      prisma.favorito.count({ where: { userId: user.id, producto: { ...EN_TIENDA } } }),
      cargarConfig(),
      prisma.pedido.findFirst({
        where: {
          userId: user.id,
          estadoPago: 'APROBADO',
          estado: { notIn: ['CANCELADO', 'DEVUELTO'] },
          items: { some: { linea: { in: LINEAS_CON_RECETA } } },
        },
        orderBy: { pagadoEn: 'desc' },
        select: { pagadoEn: true, createdAt: true },
      }),
    ]);
    const ultima = ultimaRecetado?.pagadoEn ?? ultimaRecetado?.createdAt ?? null;
    return {
      user: publico(user),
      resumen: { pedidos, recetas, direcciones, favoritos },
      rivedere: {
        ultimaCompraRecetado: ultima,
        proximoAviso: ultima ? sumarMeses(ultima, cfg.rivedereMeses) : null,
        meses: cfg.rivedereMeses,
        descuentoPct: dec(cfg.rivedereDescuentoPct) ?? 0,
        avisadoEn: user.rivedereAvisadoEn,
      },
    };
  });

  // ---------- Datos personales ----------

  app.put('/datos', async (request) => {
    const body = parse(datosInput, request.body);
    const actual = await usuarioActual(request.user.sub);
    const user = await prisma.user.update({
      where: { id: actual.id },
      data: {
        nombre: body.nombre,
        ...(body.telefono !== undefined ? { telefono: body.telefono } : {}),
        ...(body.newsletter !== undefined ? { newsletter: body.newsletter } : {}),
      },
      include: { optica: { select: { id: true, nombre: true, slug: true } } },
    });
    if (body.newsletter !== undefined) {
      if (body.newsletter) {
        await prisma.suscripcionNewsletter.upsert({
          where: { email: user.email },
          create: { email: user.email, nombre: user.nombre, origen: 'cuenta' },
          update: { bajaEn: null, nombre: user.nombre },
        });
      } else {
        await prisma.suscripcionNewsletter.updateMany({ where: { email: user.email, bajaEn: null }, data: { bajaEn: new Date() } });
      }
    }
    return { user: publico(user) };
  });

  app.put('/password', async (request, reply) => {
    const body = parse(cambioPasswordInput, request.body);
    const user = await usuarioActual(request.user.sub);
    const tienePassword = !user.passwordHash.startsWith('!');
    if (tienePassword) {
      if (!body.actual) throw Errors.badRequest('Ingresá tu contraseña actual', [{ path: 'actual', message: 'Ingresá tu contraseña actual' }]);
      const ok = await argon2.verify(user.passwordHash, body.actual);
      if (!ok) throw Errors.badRequest('La contraseña actual no es correcta', [{ path: 'actual', message: 'La contraseña actual no es correcta' }]);
    }
    const passwordHash = await argon2.hash(body.nueva, { type: argon2.argon2id });
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return reply.status(204).send();
  });

  // ---------- Pedidos ----------

  app.get('/pedidos', async (request) => {
    const pedidos = await prisma.pedido.findMany({
      where: { userId: request.user.sub },
      include: pedidoInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items: pedidos.map((p) => serializePedido(p)) };
  });

  app.get<{ Params: { id: string } }>('/pedidos/:id', async (request) => {
    const p = await prisma.pedido.findUnique({ where: { id: request.params.id }, include: pedidoIncludeDetalle });
    if (!p) throw Errors.notFound('Pedido no encontrado');
    if (p.userId !== request.user.sub) throw Errors.forbidden('Este pedido pertenece a otra cuenta');
    // La serialización pública no incluye la línea de tiempo ni los turnos: se agregan acá, filtrados.
    return {
      ...serializePedido(p),
      eventos: p.eventos.filter((e) => (EVENTOS_CLIENTE as readonly string[]).includes(e.tipo)).map(serializeEvento),
      turnos: p.turnos.map(serializeTurno),
      reembolsado: dec(p.reembolsado) ?? 0,
      calificacion: await prisma.calificacionPedido.findUnique({
        where: { pedidoId: p.id },
        select: { puntaje: true, comentario: true, createdAt: true },
      }),
    };
  });

  /** B2B 4: el cliente califica (1 a 5) un pedido entregado; alimenta la satisfacción de la óptica. */
  app.post<{ Params: { id: string } }>('/pedidos/:id/calificacion', async (request, reply) => {
    const body = parse(calificacionInput, request.body);
    const p = await prisma.pedido.findUnique({ where: { id: request.params.id }, select: { id: true, userId: true, estado: true, opticaId: true } });
    if (!p) throw Errors.notFound('Pedido no encontrado');
    if (p.userId !== request.user.sub) throw Errors.forbidden('Este pedido pertenece a otra cuenta');
    if (p.estado !== 'ENTREGADO') throw Errors.badRequest('Podés calificar el pedido cuando lo recibas');
    const ya = await prisma.calificacionPedido.findUnique({ where: { pedidoId: p.id } });
    if (ya) throw Errors.conflict('Ya calificaste este pedido');
    const c = await prisma.calificacionPedido.create({
      data: { pedidoId: p.id, opticaId: p.opticaId, puntaje: body.puntaje, comentario: body.comentario || null },
      select: { puntaje: true, comentario: true, createdAt: true },
    });
    return reply.status(201).send(c);
  });

  // ---------- Recetas ----------

  app.get('/recetas', async (request) => {
    const recetas = await prisma.receta.findMany({
      where: { userId: request.user.sub },
      orderBy: { createdAt: 'desc' },
      include: { pedidos: { select: { id: true, numero: true }, orderBy: { createdAt: 'desc' } } },
      take: 50,
    });
    return {
      items: recetas.map((r) => ({ ...serializeReceta(r), pedidos: r.pedidos })),
    };
  });

  app.delete<{ Params: { id: string } }>('/recetas/:id', async (request, reply) => {
    const r = await prisma.receta.findUnique({ where: { id: request.params.id }, include: { _count: { select: { pedidos: true } } } });
    if (!r || r.userId !== request.user.sub) throw Errors.notFound('Receta no encontrada');
    if (r._count.pedidos > 0) throw Errors.conflict('Esta receta está asociada a un pedido y no se puede borrar');
    await prisma.receta.delete({ where: { id: r.id } });
    return reply.status(204).send();
  });

  // ---------- Direcciones ----------

  app.get('/direcciones', async (request) => {
    const items = await prisma.direccion.findMany({
      where: { userId: request.user.sub },
      orderBy: [{ predeterminada: 'desc' }, { createdAt: 'asc' }],
    });
    return { items: items.map(serializeDireccion) };
  });

  app.post('/direcciones', async (request, reply) => {
    const body = parse(direccionCuentaInput, request.body);
    const userId = request.user.sub;
    const { predeterminada, ...datos } = body;
    const d = await prisma.$transaction(async (tx) => {
      const cuantas = await tx.direccion.count({ where: { userId } });
      if (cuantas >= 10) throw Errors.badRequest('Podés guardar hasta 10 direcciones');
      const esPredeterminada = predeterminada === true || cuantas === 0;
      if (esPredeterminada) await tx.direccion.updateMany({ where: { userId, predeterminada: true }, data: { predeterminada: false } });
      return tx.direccion.create({ data: { ...datos, userId, predeterminada: esPredeterminada } });
    });
    return reply.status(201).send(serializeDireccion(d));
  });

  app.put<{ Params: { id: string } }>('/direcciones/:id', async (request) => {
    const body = parse(direccionCuentaInput, request.body);
    const userId = request.user.sub;
    const existing = await prisma.direccion.findUnique({ where: { id: request.params.id } });
    if (!existing || existing.userId !== userId) throw Errors.notFound('Dirección no encontrada');
    const { predeterminada, ...datos } = body;
    const d = await prisma.$transaction(async (tx) => {
      if (predeterminada === true) await tx.direccion.updateMany({ where: { userId, predeterminada: true }, data: { predeterminada: false } });
      return tx.direccion.update({
        where: { id: existing.id },
        data: { ...datos, ...(predeterminada === true ? { predeterminada: true } : {}) },
      });
    });
    return serializeDireccion(d);
  });

  app.post<{ Params: { id: string } }>('/direcciones/:id/predeterminada', async (request) => {
    const userId = request.user.sub;
    const existing = await prisma.direccion.findUnique({ where: { id: request.params.id } });
    if (!existing || existing.userId !== userId) throw Errors.notFound('Dirección no encontrada');
    const d = await prisma.$transaction(async (tx) => {
      await tx.direccion.updateMany({ where: { userId, predeterminada: true }, data: { predeterminada: false } });
      return tx.direccion.update({ where: { id: existing.id }, data: { predeterminada: true } });
    });
    return serializeDireccion(d);
  });

  app.delete<{ Params: { id: string } }>('/direcciones/:id', async (request, reply) => {
    const userId = request.user.sub;
    const existing = await prisma.direccion.findUnique({ where: { id: request.params.id } });
    if (!existing || existing.userId !== userId) throw Errors.notFound('Dirección no encontrada');
    await prisma.$transaction(async (tx) => {
      await tx.direccion.delete({ where: { id: existing.id } });
      if (existing.predeterminada) {
        const siguiente = await tx.direccion.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
        if (siguiente) await tx.direccion.update({ where: { id: siguiente.id }, data: { predeterminada: true } });
      }
    });
    return reply.status(204).send();
  });

  // ---------- Favoritos ----------

  app.get('/favoritos', async (request) => {
    const favs = await prisma.favorito.findMany({
      where: { userId: request.user.sub, producto: { ...EN_TIENDA } },
      include: { producto: { include: productoInclude } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { items: favs.map((f) => ({ ...serializeProductoPublico(f.producto), favoritoEn: f.createdAt })) };
  });

  app.get('/favoritos/ids', async (request) => {
    const favs = await prisma.favorito.findMany({ where: { userId: request.user.sub }, select: { productoId: true } });
    return { ids: favs.map((f) => f.productoId) };
  });

  app.put<{ Params: { productoId: string } }>('/favoritos/:productoId', async (request, reply) => {
    const producto = await prisma.producto.findUnique({ where: { id: request.params.productoId }, select: { id: true, estado: true, visibleTienda: true } });
    if (!producto || producto.estado !== 'PUBLICADO' || !producto.visibleTienda) throw Errors.notFound('Producto no encontrado');
    await prisma.favorito.upsert({
      where: { userId_productoId: { userId: request.user.sub, productoId: producto.id } },
      create: { userId: request.user.sub, productoId: producto.id },
      update: {},
    });
    return reply.status(204).send();
  });

  app.delete<{ Params: { productoId: string } }>('/favoritos/:productoId', async (request, reply) => {
    await prisma.favorito.deleteMany({ where: { userId: request.user.sub, productoId: request.params.productoId } });
    return reply.status(204).send();
  });

  // ---------- Referidos ----------

  app.get('/referidos', async (request) => {
    const user = await usuarioActual(request.user.sub);
    const [codigo, cfg, referidos, cupones] = await Promise.all([
      asegurarCodigoReferido(user.id),
      cargarConfig(),
      prisma.user.findMany({
        where: { referidoPorId: user.id },
        select: { nombre: true, createdAt: true, referidoRecompensadoEn: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      cuponesDelCliente(user.email),
    ]);
    return {
      codigo,
      link: linkReferido(app.env, codigo),
      descuentoPct: dec(cfg.referidoDescuentoPct) ?? 0,
      referidos: referidos.map((r) => ({
        nombre: nombreAbreviado(r.nombre),
        estado: r.referidoRecompensadoEn ? 'COMPRO' : 'REGISTRADO',
        createdAt: r.createdAt,
        compradoEn: r.referidoRecompensadoEn,
      })),
      cupones: cupones.map((c) => ({
        codigo: c.codigo,
        descripcion: c.descripcion,
        tipo: c.tipo,
        valor: dec(c.valor) ?? 0,
        vigenciaHasta: c.vigenciaHasta,
        usos: c.usos,
        usosMax: c.usosMax,
        activo: c.activo && (!c.vigenciaHasta || c.vigenciaHasta.getTime() > Date.now()) && (c.usosMax === null || c.usos < c.usosMax),
        programa: c.codigo.startsWith('RIVEDERE-') ? 'RIVEDERE' : 'REFERIDOS',
        createdAt: c.createdAt,
      })),
    };
  });
};

export default cuentaRoutes;
