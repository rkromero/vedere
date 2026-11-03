// Reembolsos totales o parciales desde el admin: por Mercado Pago (API de refunds) o registrados a mano
// (transferencia). Actualiza el acumulado del pedido, registra el evento y avisa al cliente.
import { prisma } from '@vedere/db';
import type { Env } from '../env.js';
import { cambiarEstado, registrarEvento } from './asignacion.js';
import type { Actor } from './asignacion.js';
import { emailReembolso } from './email.js';
import { AppError, Errors } from './errors.js';
import { mpConfig, reembolsarPagoMP } from './mercadopago.js';
import { cancelarPedido, pedidoIncludeDetalle } from './pedidos.js';
import type { PedidoDetalle } from './pedidos.js';
import { dec } from './serialize.js';

export interface ReembolsoOpts {
  env: Env;
  actor: Actor;
  motivo: string;
  /** Parcial; vacío = todo lo pendiente. */
  monto?: number | null;
  /** Cancelar el pedido (repone stock). Default: sólo si el reembolso es total y el pedido no fue entregado. */
  cancelar?: boolean;
}

export async function reembolsarPedido(pedidoId: string, opts: ReembolsoOpts): Promise<PedidoDetalle> {
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, include: { pagos: true, reembolsos: true } });
  if (!pedido) throw Errors.notFound('Pedido no encontrado');
  if (pedido.estadoPago !== 'APROBADO' && pedido.estadoPago !== 'REEMBOLSADO') {
    throw Errors.badRequest('El pedido no tiene un pago aprobado para reembolsar');
  }
  const total = dec(pedido.total) ?? 0;
  const yaReembolsado = dec(pedido.reembolsado) ?? 0;
  const pendiente = Math.round((total - yaReembolsado) * 100) / 100;
  if (pendiente <= 0) throw Errors.badRequest('El pedido ya fue reembolsado por completo');
  const monto = Math.round((opts.monto ?? pendiente) * 100) / 100;
  if (monto > pendiente) {
    throw Errors.badRequest(`El monto supera lo pendiente de reembolso ($${pendiente.toLocaleString('es-AR')})`, [
      { path: 'monto', message: `Máximo $${pendiente.toLocaleString('es-AR')}` },
    ]);
  }
  const esTotal = monto >= pendiente;

  // Mercado Pago: refund real contra la API. Transferencia: registro manual.
  let proveedor = 'manual';
  let externoId: string | null = null;
  let detalle: Record<string, unknown> | undefined;
  const pagoMP = pedido.pagos.find((p) => p.proveedor === 'mercadopago' && p.estado === 'APROBADO' && p.externoId);
  if (pedido.metodoPago !== 'TRANSFERENCIA' && pagoMP?.externoId) {
    const cfg = mpConfig(opts.env);
    if (!cfg) throw new AppError(503, 'MP_DISABLED', 'Mercado Pago no está configurado: no se puede reembolsar automáticamente');
    const r = await reembolsarPagoMP(cfg, {
      paymentId: pagoMP.externoId,
      monto: esTotal && yaReembolsado === 0 ? null : monto,
      idempotencyKey: `ref-${pedido.id}-${pedido.reembolsos.length + 1}-${Math.round(monto * 100)}`,
    });
    if (r.status === 'rejected' || r.status === 'cancelled') {
      throw new AppError(502, 'MP_ERROR', `Mercado Pago rechazó el reembolso (${r.status})`);
    }
    proveedor = 'mercadopago';
    externoId = String(r.id);
    detalle = { status: r.status, amount: r.amount, paymentId: pagoMP.externoId };
  }

  const nuevoAcumulado = Math.round((yaReembolsado + monto) * 100) / 100;
  await prisma.$transaction(async (tx) => {
    await tx.reembolso.create({
      data: {
        pedidoId: pedido.id,
        pagoId: pagoMP?.id ?? null,
        proveedor,
        externoId,
        monto,
        motivo: opts.motivo,
        estado: 'APROBADO',
        detalle: detalle as never,
        creadoPorId: opts.actor.id,
      },
    });
    await tx.pedido.update({
      where: { id: pedido.id },
      data: {
        reembolsado: nuevoAcumulado,
        ...(nuevoAcumulado >= total ? { estadoPago: 'REEMBOLSADO' } : {}),
      },
    });
    await registrarEvento(tx, {
      pedidoId: pedido.id,
      tipo: 'REEMBOLSO',
      opticaId: pedido.opticaId,
      actor: opts.actor,
      nota: `Reembolso ${esTotal ? 'total' : 'parcial'} de $${monto.toLocaleString('es-AR')} (${proveedor}${externoId ? ` #${externoId}` : ''}): ${opts.motivo}`,
      datos: { monto, proveedor, externoId, acumulado: nuevoAcumulado, total },
    });
  });

  const p0 = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id }, include: pedidoIncludeDetalle });
  await emailReembolso(opts.env, { ...p0, items: p0.items }, monto, opts.motivo);

  const entregado = pedido.estado === 'ENTREGADO' || pedido.estado === 'DEVUELTO';
  const cancelar = opts.cancelar ?? (esTotal && !entregado && pedido.estado !== 'CANCELADO');
  if (cancelar && pedido.estado !== 'CANCELADO' && !entregado) {
    await cancelarPedido(pedido.id, { motivo: `Reembolso: ${opts.motivo}`, actor: opts.actor, env: opts.env });
  } else if (esTotal && pedido.estado === 'ENTREGADO') {
    await cambiarEstado(pedido.id, 'DEVUELTO', { env: opts.env, actor: opts.actor, nota: `Reembolso total: ${opts.motivo}` });
  }
  return prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id }, include: pedidoIncludeDetalle });
}
