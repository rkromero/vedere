// Reservas de stock durante el pago: se descuentan de la disponibilidad mientras están ACTIVAS,
// se CONSUMEN al aprobarse el pago (ahí se descuenta el stock real) y se LIBERAN si vencen o
// el pedido se cancela.
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';

type Db = Prisma.TransactionClient | typeof prisma;

/** Marca como LIBERADA toda reserva activa vencida. Devuelve cuántas liberó. */
export async function liberarReservasVencidas(db: Db = prisma, ahora = new Date()): Promise<number> {
  const res = await db.reservaStock.updateMany({
    where: { estado: 'ACTIVA', expiraEn: { lt: ahora } },
    data: { estado: 'LIBERADA' },
  });
  return res.count;
}

/** Unidades reservadas (activas) por variante. */
export async function reservadoPorVariante(
  varianteIds: string[],
  db: Db = prisma,
  excluirPedidoId?: string,
): Promise<Map<string, number>> {
  if (varianteIds.length === 0) return new Map();
  const filas = await db.reservaStock.groupBy({
    by: ['varianteId'],
    where: {
      varianteId: { in: varianteIds },
      estado: 'ACTIVA',
      ...(excluirPedidoId ? { pedidoId: { not: excluirPedidoId } } : {}),
    },
    _sum: { cantidad: true },
  });
  return new Map(filas.map((f) => [f.varianteId, f._sum.cantidad ?? 0]));
}

/** Stock disponible = stock físico − reservas activas de otros pedidos. */
export async function disponibilidad(
  variantes: Array<{ id: string; stock: number }>,
  db: Db = prisma,
  excluirPedidoId?: string,
): Promise<Map<string, number>> {
  const reservado = await reservadoPorVariante(
    variantes.map((v) => v.id),
    db,
    excluirPedidoId,
  );
  return new Map(variantes.map((v) => [v.id, Math.max(0, v.stock - (reservado.get(v.id) ?? 0))]));
}
