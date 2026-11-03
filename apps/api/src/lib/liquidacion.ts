// Liquidación mensual de ópticas: pedidos ENTREGADOS en el mes (hora de Argentina), monto y comisión.
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { dec } from './serialize.js';

type Db = Prisma.TransactionClient | typeof prisma;

const TZ_OFFSET_MS = -3 * 3600_000;

/** Rango UTC del mes local AAAA-MM (default: mes actual en Argentina). */
export function rangoMes(mes?: string | null, ahora = new Date()): { mes: string; desde: Date; hasta: Date } {
  let anio: number;
  let mesIdx: number;
  if (mes) {
    anio = Number(mes.slice(0, 4));
    mesIdx = Number(mes.slice(5, 7)) - 1;
  } else {
    const local = new Date(ahora.getTime() + TZ_OFFSET_MS);
    anio = local.getUTCFullYear();
    mesIdx = local.getUTCMonth();
  }
  const desde = new Date(Date.UTC(anio, mesIdx, 1) - TZ_OFFSET_MS);
  const hasta = new Date(Date.UTC(anio, mesIdx + 1, 1) - TZ_OFFSET_MS);
  return { mes: `${anio}-${String(mesIdx + 1).padStart(2, '0')}`, desde, hasta };
}

export interface LiquidacionPedido {
  id: string;
  numero: string;
  entregadoEn: Date | null;
  cliente: string;
  total: number;
  comisionPct: number;
  comision: number;
  items: number;
}

export interface Liquidacion {
  mes: string;
  desde: Date;
  hasta: Date;
  optica: { id: string; nombre: string; comisionPct: number } | null;
  pedidos: LiquidacionPedido[];
  cantidad: number;
  monto: number;
  comision: number;
}

function filaLiquidacion(p: {
  id: string;
  numero: string;
  entregadoEn: Date | null;
  nombre: string;
  total: Prisma.Decimal;
  comisionPct: Prisma.Decimal | null;
  comisionMonto: Prisma.Decimal | null;
  _count: { items: number };
}, pctOptica: number): LiquidacionPedido {
  const total = dec(p.total) ?? 0;
  const pct = dec(p.comisionPct) ?? pctOptica;
  const comision = dec(p.comisionMonto) ?? Math.round(total * pct) / 100;
  return { id: p.id, numero: p.numero, entregadoEn: p.entregadoEn, cliente: p.nombre, total, comisionPct: pct, comision, items: p._count.items };
}

/** Liquidación de una óptica para un mes. */
export async function liquidacionOptica(opticaId: string, mes?: string | null, db: Db = prisma): Promise<Liquidacion> {
  const r = rangoMes(mes);
  const [optica, pedidos] = await Promise.all([
    db.optica.findUnique({ where: { id: opticaId }, select: { id: true, nombre: true, comisionPct: true } }),
    db.pedido.findMany({
      where: { opticaId, estado: 'ENTREGADO', entregadoEn: { gte: r.desde, lt: r.hasta } },
      orderBy: { entregadoEn: 'asc' },
      select: { id: true, numero: true, entregadoEn: true, nombre: true, total: true, comisionPct: true, comisionMonto: true, _count: { select: { items: true } } },
    }),
  ]);
  const pct = dec(optica?.comisionPct) ?? 0;
  const filas = pedidos.map((p) => filaLiquidacion(p, pct));
  return {
    mes: r.mes,
    desde: r.desde,
    hasta: r.hasta,
    optica: optica ? { id: optica.id, nombre: optica.nombre, comisionPct: pct } : null,
    pedidos: filas,
    cantidad: filas.length,
    monto: Math.round(filas.reduce((a, f) => a + f.total, 0) * 100) / 100,
    comision: Math.round(filas.reduce((a, f) => a + f.comision, 0) * 100) / 100,
  };
}

/** Resumen de todas las ópticas para un mes (admin). */
export async function liquidacionGeneral(mes?: string | null, db: Db = prisma) {
  const r = rangoMes(mes);
  const [opticas, pedidos] = await Promise.all([
    db.optica.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, comisionPct: true, activa: true } }),
    db.pedido.findMany({
      where: { estado: 'ENTREGADO', entregadoEn: { gte: r.desde, lt: r.hasta }, opticaId: { not: null } },
      select: { opticaId: true, total: true, comisionPct: true, comisionMonto: true },
    }),
  ]);
  const porOptica = new Map<string, { cantidad: number; monto: number; comision: number }>();
  for (const p of pedidos) {
    const o = opticas.find((x) => x.id === p.opticaId);
    const total = dec(p.total) ?? 0;
    const pct = dec(p.comisionPct) ?? dec(o?.comisionPct) ?? 0;
    const comision = dec(p.comisionMonto) ?? Math.round(total * pct) / 100;
    const acc = porOptica.get(p.opticaId!) ?? { cantidad: 0, monto: 0, comision: 0 };
    acc.cantidad += 1;
    acc.monto += total;
    acc.comision += comision;
    porOptica.set(p.opticaId!, acc);
  }
  const items = opticas.map((o) => {
    const acc = porOptica.get(o.id) ?? { cantidad: 0, monto: 0, comision: 0 };
    return {
      optica: { id: o.id, nombre: o.nombre, activa: o.activa, comisionPct: dec(o.comisionPct) ?? 0 },
      cantidad: acc.cantidad,
      monto: Math.round(acc.monto * 100) / 100,
      comision: Math.round(acc.comision * 100) / 100,
    };
  });
  return {
    mes: r.mes,
    desde: r.desde,
    hasta: r.hasta,
    items,
    totales: {
      cantidad: items.reduce((a, i) => a + i.cantidad, 0),
      monto: Math.round(items.reduce((a, i) => a + i.monto, 0) * 100) / 100,
      comision: Math.round(items.reduce((a, i) => a + i.comision, 0) * 100) / 100,
    },
  };
}
