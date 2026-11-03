// Cambios y devoluciones: el cliente solicita, el admin aprueba (nuevo pedido sin cargo o reintegro)
// o rechaza. Cada paso queda en la línea de tiempo y avisa por email.
import { prisma } from '@vedere/db';
import type { Prisma, SolicitudCambio } from '@vedere/db';
import type { Env } from '../env.js';
import { asignarAutomatico, cambiarEstado, pedidoParaEmail, registrarEvento } from './asignacion.js';
import type { Actor } from './asignacion.js';
import { emailAdmin, emailSolicitud } from './email.js';
import { AppError, Errors } from './errors.js';
import { pedidoInclude, pedidoIncludeDetalle, siguienteNumero } from './pedidos.js';
import type { PedidoDetalle, PedidoFull } from './pedidos.js';
import { reembolsarPedido } from './reembolsos.js';
import { dec } from './serialize.js';

const DIAS_PARA_CAMBIO = 30;

export async function crearSolicitud(
  pedidoId: string,
  input: { tipo: 'CAMBIO' | 'DEVOLUCION'; motivo: string; detalle?: string | null; email?: string | null; userId?: string | null },
  env: Env,
): Promise<{ solicitud: SolicitudCambio; pedido: PedidoFull }> {
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, include: { ...pedidoInclude, solicitudes: true } });
  if (!pedido) throw Errors.notFound('Pedido no encontrado');
  const esDuenio = (pedido.userId && input.userId === pedido.userId) || (input.email && input.email === pedido.email);
  if (!esDuenio) throw Errors.forbidden('Este pedido pertenece a otra persona');
  if (pedido.estado !== 'ENTREGADO' && pedido.estado !== 'ENVIADO' && pedido.estado !== 'LISTO') {
    throw Errors.badRequest('Los cambios y devoluciones se piden una vez que recibiste el pedido');
  }
  const referencia = pedido.entregadoEn ?? pedido.enviadoEn ?? pedido.createdAt;
  if (Date.now() - referencia.getTime() > DIAS_PARA_CAMBIO * 86400_000) {
    throw Errors.badRequest(`El plazo para cambios y devoluciones es de ${DIAS_PARA_CAMBIO} días desde la entrega`);
  }
  if (pedido.solicitudes.some((s) => s.estado === 'PENDIENTE')) {
    throw Errors.conflict('Ya hay una solicitud pendiente para este pedido');
  }
  const solicitud = await prisma.$transaction(async (tx) => {
    const s = await tx.solicitudCambio.create({
      data: { pedidoId, tipo: input.tipo, motivo: input.motivo, detalle: input.detalle ?? null },
    });
    await registrarEvento(tx, {
      pedidoId,
      tipo: 'SOLICITUD',
      opticaId: pedido.opticaId,
      actor: { id: input.userId ?? null, nombre: pedido.nombre, rol: 'CLIENTE' },
      nota: `Solicitud de ${input.tipo === 'CAMBIO' ? 'cambio' : 'devolución'}: ${input.motivo}`,
      datos: { solicitudId: s.id, tipo: input.tipo, detalle: input.detalle ?? null },
    });
    return s;
  });
  await emailSolicitud(env, pedidoParaEmail(pedido), { tipo: input.tipo, estado: 'PENDIENTE' });
  await emailAdmin(env, {
    tipo: 'ADMIN_SOLICITUD',
    asunto: `Solicitud de ${input.tipo === 'CAMBIO' ? 'cambio' : 'devolución'} · ${pedido.numero}`,
    cuerpoHtml: `<p><strong>${pedido.nombre}</strong> (${pedido.email}) pide ${input.tipo === 'CAMBIO' ? 'un cambio' : 'una devolución'} del pedido ${pedido.numero}.</p><p>Motivo: ${input.motivo}${input.detalle ? `<br>${input.detalle}` : ''}</p>`,
    pedidoId,
  });
  return { solicitud, pedido };
}

/** Pedido nuevo sin cargo con los mismos ítems (cambio aprobado). Descuenta stock y lo asigna. */
async function clonarPedidoSinCargo(original: PedidoDetalle, actor: Actor, env: Env): Promise<PedidoFull> {
  const nuevo = await prisma.$transaction(async (tx) => {
    const numero = await siguienteNumero(tx);
    const subtotal = original.items.reduce((a, i) => a + (dec(i.precioUnitario) ?? 0) * i.cantidad, 0);
    const faltantes: string[] = [];
    for (const i of original.items) {
      if (!i.varianteId) continue;
      const v = await tx.variante.update({
        where: { id: i.varianteId },
        data: { stock: { decrement: i.cantidad } },
        select: { stock: true, sku: true },
      });
      if (v.stock < 0) faltantes.push(`${v.sku} (${-v.stock})`);
    }
    const p = await tx.pedido.create({
      data: {
        numero,
        estado: 'PAGADO',
        userId: original.userId,
        email: original.email,
        nombre: original.nombre,
        dni: original.dni,
        telefono: original.telefono,
        modalidad: original.modalidad,
        opticaId: original.opticaId,
        direccion: original.direccion,
        piso: original.piso,
        localidad: original.localidad,
        provincia: original.provincia,
        codigoPostal: original.codigoPostal,
        lat: original.lat,
        lng: original.lng,
        placeId: original.placeId,
        direccionCompleta: original.direccionCompleta,
        recetaId: original.recetaId,
        subtotal,
        descuentos: subtotal,
        descuentosDetalle: [{ tipo: 'CAMBIO', codigo: null, descripcion: `Cambio sin cargo del pedido ${original.numero}`, monto: subtotal }] as Prisma.InputJsonValue,
        envio: 0,
        total: 0,
        metodoPago: original.metodoPago,
        estadoPago: 'APROBADO',
        pagadoEn: new Date(),
        stockDescontado: true,
        canal: 'ADMIN',
        notas: original.notas,
        notasInternas: `Cambio del pedido ${original.numero}${faltantes.length ? `\nStock insuficiente al generar el cambio: ${faltantes.join(', ')}` : ''}`,
        items: {
          create: original.items.map((i) => ({
            varianteId: i.varianteId,
            productoId: i.productoId,
            nombre: i.nombre,
            sku: i.sku,
            color: i.color,
            imagen: i.imagen,
            linea: i.linea,
            precioUnitario: i.precioUnitario,
            precioLista: i.precioLista,
            cantidad: i.cantidad,
            descuento: (dec(i.precioUnitario) ?? 0) * i.cantidad,
            total: 0,
            conReceta: i.conReceta,
          })),
        },
        pagos: { create: { metodo: original.metodoPago, proveedor: 'cambio', estado: 'APROBADO', monto: 0 } },
      },
      include: pedidoInclude,
    });
    await registrarEvento(tx, {
      pedidoId: p.id,
      tipo: 'NOTA',
      estadoNuevo: 'PAGADO',
      actor,
      nota: `Pedido generado por cambio aprobado del ${original.numero}`,
      datos: { origenPedidoId: original.id, origenNumero: original.numero },
    });
    return p;
  });
  try {
    const r = await asignarAutomatico(nuevo.id, { env, actor });
    return r.pedido;
  } catch {
    return nuevo;
  }
}

export async function aprobarSolicitud(
  solicitudId: string,
  input: { resolucion: 'NUEVO_PEDIDO' | 'REINTEGRO'; respuesta?: string | null },
  opts: { env: Env; actor: Actor },
): Promise<{ solicitud: SolicitudCambio; pedido: PedidoDetalle; nuevoPedido: PedidoFull | null }> {
  const s = await prisma.solicitudCambio.findUnique({ where: { id: solicitudId } });
  if (!s) throw Errors.notFound('Solicitud no encontrada');
  if (s.estado !== 'PENDIENTE') throw new AppError(409, 'CONFLICT', 'La solicitud ya fue resuelta');
  const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: s.pedidoId }, include: pedidoIncludeDetalle });

  let nuevoPedido: PedidoFull | null = null;
  if (input.resolucion === 'NUEVO_PEDIDO') {
    nuevoPedido = await clonarPedidoSinCargo(pedido, opts.actor, opts.env);
    if (pedido.estado === 'ENTREGADO') {
      await cambiarEstado(pedido.id, 'DEVUELTO', {
        env: opts.env,
        actor: opts.actor,
        nota: `Cambio aprobado: se generó el pedido ${nuevoPedido.numero}`,
        sinEmail: true,
      });
    }
  } else {
    // Reintegro: reembolso total (MP o manual); deja el pedido DEVUELTO / CANCELADO según corresponda.
    await reembolsarPedido(pedido.id, {
      env: opts.env,
      actor: opts.actor,
      motivo: `${s.tipo === 'CAMBIO' ? 'Cambio' : 'Devolución'} aprobada: ${s.motivo}`,
    });
  }

  const solicitud = await prisma.$transaction(async (tx) => {
    const up = await tx.solicitudCambio.update({
      where: { id: s.id },
      data: {
        estado: 'APROBADA',
        resolucion: input.resolucion,
        respuesta: input.respuesta ?? null,
        nuevoPedidoId: nuevoPedido?.id ?? null,
        resueltoPorId: opts.actor.id,
        resueltoEn: new Date(),
      },
    });
    await registrarEvento(tx, {
      pedidoId: pedido.id,
      tipo: 'SOLICITUD',
      opticaId: pedido.opticaId,
      actor: opts.actor,
      nota: `Solicitud aprobada (${input.resolucion === 'NUEVO_PEDIDO' ? `nuevo pedido ${nuevoPedido?.numero}` : 'reintegro'})${input.respuesta ? `: ${input.respuesta}` : ''}`,
      datos: { solicitudId: s.id, resolucion: input.resolucion, nuevoPedidoId: nuevoPedido?.id ?? null },
    });
    return up;
  });
  await emailSolicitud(opts.env, pedidoParaEmail(pedido), {
    tipo: s.tipo,
    estado: 'APROBADA',
    resolucion: input.resolucion,
    respuesta: input.respuesta ?? null,
  });
  const actualizado = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id }, include: pedidoIncludeDetalle });
  return { solicitud, pedido: actualizado, nuevoPedido };
}

export async function rechazarSolicitud(
  solicitudId: string,
  input: { respuesta: string },
  opts: { env: Env; actor: Actor },
): Promise<{ solicitud: SolicitudCambio; pedido: PedidoDetalle }> {
  const s = await prisma.solicitudCambio.findUnique({ where: { id: solicitudId } });
  if (!s) throw Errors.notFound('Solicitud no encontrada');
  if (s.estado !== 'PENDIENTE') throw new AppError(409, 'CONFLICT', 'La solicitud ya fue resuelta');
  const solicitud = await prisma.$transaction(async (tx) => {
    const up = await tx.solicitudCambio.update({
      where: { id: s.id },
      data: { estado: 'RECHAZADA', respuesta: input.respuesta, resueltoPorId: opts.actor.id, resueltoEn: new Date() },
    });
    await registrarEvento(tx, {
      pedidoId: s.pedidoId,
      tipo: 'SOLICITUD',
      actor: opts.actor,
      nota: `Solicitud rechazada: ${input.respuesta}`,
      datos: { solicitudId: s.id },
    });
    return up;
  });
  const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: s.pedidoId }, include: pedidoIncludeDetalle });
  await emailSolicitud(opts.env, pedidoParaEmail(pedido), { tipo: s.tipo, estado: 'RECHAZADA', respuesta: input.respuesta });
  return { solicitud, pedido };
}
