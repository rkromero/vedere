// B2B 3: cuenta corriente de las ópticas. El saldo NUNCA se guarda: es la suma de los movimientos
// (importe con signo: + deuda, − crédito). Cada pedido que sale del depósito genera un DEBITO_PEDIDO que
// vence a los N días (plazo vigente al confirmar la compra). Los créditos (pagos, notas de crédito,
// comisiones de la liquidación y ajustes negativos) se imputan a los pedidos: primero lo que indique el
// admin y el resto a los más viejos. Así cada pedido queda impago, parcialmente pagado o pagado.
import { prisma } from '@vedere/db';
import type { MedioPagoCuenta, MovimientoCuenta, Prisma, TipoMovimientoCuenta } from '@vedere/db';
import type { Env } from '../env.js';
import { enviarEmail, layoutEmail } from './email.js';
import { Errors } from './errors.js';
import { liquidacionGeneral, rangoMes } from './liquidacion.js';
import { getConfigMayorista, round2 } from './mayorista.js';
import { dec } from './serialize.js';

type Db = Prisma.TransactionClient | typeof prisma;

export interface ActorCuenta {
  id: string | null;
  nombre: string;
}

const DIA = 86_400_000;
const CENTAVO = 0.004;

/** El pedido salió del depósito: ya generó su débito. */
export const ESTADOS_DEBITADOS = ['LISTO_PARA_RETIRO', 'DESPACHADO', 'ENTREGADO'] as const;
/** Aprobados todavía sin salir: comprometen crédito. */
export const ESTADOS_COMPROMETIDOS = ['APROBADO', 'EN_PREPARACION'] as const;

export const MEDIO_LABEL: Record<MedioPagoCuenta, string> = {
  TRANSFERENCIA: 'Transferencia',
  ECHEQ: 'E-cheq',
  EFECTIVO: 'Efectivo',
};

export const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimientoCuenta, string> = {
  DEBITO_PEDIDO: 'Pedido',
  PAGO: 'Pago',
  NOTA_CREDITO: 'Nota de crédito',
  CREDITO_LIQUIDACION: 'Comisión pedidos web',
  AJUSTE: 'Ajuste',
};

export const ars = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

// ------------------------------------------------------------------
// Cuenta y saldo
// ------------------------------------------------------------------

export async function cuentaDe(opticaId: string, db: Db = prisma) {
  return db.cuentaCorriente.upsert({ where: { opticaId }, create: { opticaId }, update: {} });
}

export async function saldoDe(cuentaId: string, db: Db = prisma): Promise<number> {
  const agg = await db.movimientoCuenta.aggregate({ where: { cuentaId }, _sum: { importe: true } });
  return round2(dec(agg._sum.importe) ?? 0);
}

export type EstadoPago = 'NO_APLICA' | 'IMPAGO' | 'PARCIAL' | 'PAGADO';

export function estadoPago(debitado: boolean, total: number, pagado: number): EstadoPago {
  if (!debitado) return 'NO_APLICA';
  if (pagado <= CENTAVO) return 'IMPAGO';
  if (total - pagado > CENTAVO) return 'PARCIAL';
  return 'PAGADO';
}

export interface PedidoConDeuda {
  id: string;
  numero: string;
  total: number;
  pagado: number;
  pendiente: number;
  venceEn: Date;
  diasVencido: number;
}

/** Pedidos debitados de la óptica con saldo pendiente, del vencimiento más viejo al más nuevo. */
export async function pedidosConDeuda(opticaId: string, db: Db = prisma, ahora = new Date()): Promise<PedidoConDeuda[]> {
  const pedidos = await db.pedidoMayorista.findMany({
    where: { opticaId, venceEn: { not: null } },
    select: { id: true, numero: true, total: true, venceEn: true, imputaciones: { select: { monto: true } } },
    orderBy: [{ venceEn: 'asc' }, { createdAt: 'asc' }],
  });
  const out: PedidoConDeuda[] = [];
  for (const p of pedidos) {
    const total = dec(p.total)!;
    const pagado = round2(p.imputaciones.reduce((a, i) => a + dec(i.monto)!, 0));
    const pendiente = round2(total - pagado);
    if (pendiente <= CENTAVO) continue;
    const diasVencido = Math.max(0, Math.floor((ahora.getTime() - p.venceEn!.getTime()) / DIA));
    out.push({ id: p.id, numero: p.numero, total, pagado, pendiente, venceEn: p.venceEn!, diasVencido: p.venceEn! < ahora ? diasVencido : 0 });
  }
  return out;
}

export interface ResumenCuenta {
  opticaId: string;
  cuentaId: string;
  limiteCredito: number;
  plazoPagoDias: number;
  saldo: number;
  /** Pedidos aprobados que todavía no salieron (no son deuda, pero consumen crédito). */
  comprometido: number;
  disponible: number;
  deudaVencida: number;
  /** Deuda vencida hace más de `diasTolerancia` días: frena la aprobación automática. */
  deudaEnMora: number;
  diasTolerancia: number;
  proximosVencimientos: PedidoConDeuda[];
  vencidos: PedidoConDeuda[];
}

export async function resumenCuenta(opticaId: string, opts: { db?: Db; ahora?: Date } = {}): Promise<ResumenCuenta> {
  const db = opts.db ?? prisma;
  const ahora = opts.ahora ?? new Date();
  const [cuenta, cfg] = await Promise.all([cuentaDe(opticaId, db), getConfigMayorista(db)]);
  const [saldo, comprometidoAgg, pendientes] = await Promise.all([
    saldoDe(cuenta.id, db),
    db.pedidoMayorista.aggregate({
      where: { opticaId, estado: { in: [...ESTADOS_COMPROMETIDOS] } },
      _sum: { total: true },
    }),
    pedidosConDeuda(opticaId, db, ahora),
  ]);
  const limiteCredito = dec(cuenta.limiteCredito)!;
  const comprometido = round2(dec(comprometidoAgg._sum.total) ?? 0);
  const deuda = Math.max(saldo, 0);
  const vencidos = pendientes.filter((p) => p.venceEn < ahora);
  const corte = new Date(ahora.getTime() - cfg.diasToleranciaVencida * DIA);
  const sumar = (xs: PedidoConDeuda[]) => xs.reduce((a, p) => a + p.pendiente, 0);
  return {
    opticaId,
    cuentaId: cuenta.id,
    limiteCredito,
    plazoPagoDias: cuenta.plazoPagoDias,
    saldo,
    comprometido,
    disponible: round2(limiteCredito - saldo - comprometido),
    deudaVencida: round2(Math.min(deuda, sumar(vencidos))),
    deudaEnMora: round2(Math.min(deuda, sumar(pendientes.filter((p) => p.venceEn < corte)))),
    diasTolerancia: cfg.diasToleranciaVencida,
    proximosVencimientos: pendientes.filter((p) => p.venceEn >= ahora).slice(0, 20),
    vencidos,
  };
}

export function serializeResumen(r: ResumenCuenta) {
  const fila = (p: PedidoConDeuda) => ({ ...p });
  return { ...r, proximosVencimientos: r.proximosVencimientos.map(fila), vencidos: r.vencidos.map(fila) };
}

/** Regla de aprobación automática: dentro del crédito disponible y sin deuda vencida en mora. */
export function evaluarCredito(r: ResumenCuenta, total: number): { ok: true } | { ok: false; motivo: string } {
  if (r.deudaEnMora > CENTAVO) {
    return { ok: false, motivo: `Tiene deuda vencida hace más de ${r.diasTolerancia} días (${ars(r.deudaEnMora)})` };
  }
  if (total - r.disponible > CENTAVO) {
    return { ok: false, motivo: `Supera el crédito disponible (${ars(Math.max(r.disponible, 0))} disponible, pedido de ${ars(total)})` };
  }
  return { ok: true };
}

// ------------------------------------------------------------------
// Imputación de créditos a pedidos
// ------------------------------------------------------------------

export interface ImputacionInput {
  pedidoId: string;
  monto: number;
}

/**
 * Aplica créditos a pedidos con saldo pendiente. Primero las imputaciones explícitas de `explicitas`
 * (validadas: pedido de la óptica, debitado y sin pasarse de lo pendiente); después todo crédito de la
 * cuenta que tenga resto sin imputar va a los pedidos que vencen antes.
 */
export async function imputar(
  tx: Prisma.TransactionClient,
  cuenta: { id: string; opticaId: string },
  opts: { explicitas?: { movimientoId: string; items: ImputacionInput[] }; actor?: ActorCuenta } = {},
) {
  const pendientes = await pedidosConDeuda(cuenta.opticaId, tx);
  const pendiente = new Map(pendientes.map((p) => [p.id, p]));
  const aplicadas = new Map<string, number>();
  const crear = async (movimientoId: string, pedidoId: string, monto: number) => {
    const m = round2(monto);
    if (m <= CENTAVO) return;
    await tx.imputacionPago.create({ data: { movimientoId, pedidoId, monto: m } });
    const p = pendiente.get(pedidoId)!;
    p.pendiente = round2(p.pendiente - m);
    aplicadas.set(pedidoId, round2((aplicadas.get(pedidoId) ?? 0) + m));
  };

  if (opts.explicitas) {
    for (const it of opts.explicitas.items) {
      const p = pendiente.get(it.pedidoId);
      if (!p) throw Errors.badRequest('Sólo se puede imputar a pedidos despachados de esta óptica con saldo pendiente');
      if (it.monto - p.pendiente > CENTAVO) {
        throw Errors.badRequest(`Al pedido ${p.numero} le quedan ${ars(p.pendiente)} por pagar: no se le pueden imputar ${ars(it.monto)}`);
      }
      await crear(opts.explicitas.movimientoId, it.pedidoId, it.monto);
    }
  }

  const creditos = await tx.movimientoCuenta.findMany({
    where: { cuentaId: cuenta.id, importe: { lt: 0 } },
    select: { id: true, importe: true, imputaciones: { select: { monto: true } } },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
  });
  for (const c of creditos) {
    // c.imputaciones ya incluye las explícitas recién creadas (se leen después, en la misma transacción).
    let resto = round2(-dec(c.importe)! - c.imputaciones.reduce((a, i) => a + dec(i.monto)!, 0));
    if (resto <= CENTAVO) continue;
    for (const p of pendientes) {
      if (resto <= CENTAVO) break;
      if (p.pendiente <= CENTAVO) continue;
      const m = Math.min(resto, p.pendiente);
      await crear(c.id, p.id, m);
      resto = round2(resto - m);
    }
  }

  for (const [pedidoId, monto] of aplicadas) {
    const p = pendiente.get(pedidoId)!;
    await tx.eventoPedidoMayorista.create({
      data: {
        pedidoId,
        tipo: 'PAGO',
        nota: `Se imputaron ${ars(monto)}. ${p.pendiente <= CENTAVO ? 'Pedido pagado.' : `Quedan ${ars(p.pendiente)} por pagar.`}`,
        usuarioId: opts.actor?.id ?? null,
        usuarioNombre: opts.actor?.nombre ?? 'Sistema',
      },
    });
  }
  return aplicadas;
}

// ------------------------------------------------------------------
// Movimientos
// ------------------------------------------------------------------

/** Débito del pedido al salir del depósito. Vence a fecha de salida + plazo vigente al comprar. */
export async function registrarDebito(
  tx: Prisma.TransactionClient,
  pedido: { id: string; numero: string; opticaId: string; total: Prisma.Decimal; plazoPagoDias: number | null },
  actor: ActorCuenta,
  ahora = new Date(),
) {
  const cuenta = await cuentaDe(pedido.opticaId, tx);
  const plazo = pedido.plazoPagoDias ?? cuenta.plazoPagoDias;
  const vence = new Date(ahora.getTime() + plazo * DIA);
  const ya = await tx.movimientoCuenta.findUnique({ where: { clave: `debito:${pedido.id}` } });
  if (!ya) {
    await tx.movimientoCuenta.create({
      data: {
        cuentaId: cuenta.id,
        tipo: 'DEBITO_PEDIDO',
        importe: pedido.total,
        fecha: ahora,
        descripcion: `Pedido ${pedido.numero}`,
        pedidoMayoristaId: pedido.id,
        vencimiento: vence,
        clave: `debito:${pedido.id}`,
        creadoPorId: actor.id,
        creadoPorNombre: actor.nombre,
      },
    });
    await tx.pedidoMayorista.update({ where: { id: pedido.id }, data: { venceEn: vence, plazoPagoDias: plazo } });
    // Si la óptica tenía saldo a favor, se aplica a este pedido.
    await imputar(tx, cuenta, { actor });
  }
  return vence;
}

export interface PagoInput {
  importe: number;
  medio: MedioPagoCuenta;
  fecha?: Date | null;
  referencia?: string | null;
  comprobanteUrl?: string | null;
  notas?: string | null;
  imputaciones?: ImputacionInput[];
}

export async function registrarPagoTx(tx: Prisma.TransactionClient, opticaId: string, input: PagoInput, actor: ActorCuenta) {
  const explicitas = (input.imputaciones ?? []).filter((i) => i.monto > 0);
  const suma = round2(explicitas.reduce((a, i) => a + i.monto, 0));
  if (suma - input.importe > CENTAVO) {
    throw Errors.badRequest(`Las imputaciones suman ${ars(suma)} y el pago es de ${ars(input.importe)}`);
  }
  const cuenta = await cuentaDe(opticaId, tx);
  const mov = await tx.movimientoCuenta.create({
    data: {
      cuentaId: cuenta.id,
      tipo: 'PAGO',
      importe: -round2(input.importe),
      fecha: input.fecha ?? new Date(),
      descripcion: `Pago por ${MEDIO_LABEL[input.medio].toLowerCase()}${input.referencia ? ` · ${input.referencia}` : ''}`,
      motivo: input.notas?.trim() || null,
      medio: input.medio,
      referencia: input.referencia?.trim() || null,
      comprobanteUrl: input.comprobanteUrl ?? null,
      creadoPorId: actor.id,
      creadoPorNombre: actor.nombre,
    },
  });
  await imputar(tx, cuenta, { explicitas: { movimientoId: mov.id, items: explicitas }, actor });
  return mov;
}

export async function registrarPago(opticaId: string, input: PagoInput, actor: ActorCuenta) {
  return prisma.$transaction((tx) => registrarPagoTx(tx, opticaId, input, actor), { timeout: 20000 });
}

/** Ajuste manual (con motivo obligatorio). importe > 0 suma deuda, < 0 la resta. */
export async function registrarAjuste(opticaId: string, input: { importe: number; motivo: string }, actor: ActorCuenta) {
  if (!input.motivo?.trim()) throw Errors.badRequest('El ajuste necesita un motivo');
  if (Math.abs(input.importe) <= CENTAVO) throw Errors.badRequest('El importe del ajuste no puede ser 0');
  return prisma.$transaction(async (tx) => {
    const cuenta = await cuentaDe(opticaId, tx);
    const mov = await tx.movimientoCuenta.create({
      data: {
        cuentaId: cuenta.id,
        tipo: 'AJUSTE',
        importe: round2(input.importe),
        descripcion: input.importe > 0 ? 'Ajuste (débito)' : 'Ajuste (crédito)',
        motivo: input.motivo.trim(),
        creadoPorId: actor.id,
        creadoPorNombre: actor.nombre,
      },
    });
    if (input.importe < 0) await imputar(tx, cuenta, { actor });
    return mov;
  });
}

/** Nota de crédito por una devolución: se imputa primero al pedido devuelto. */
export async function registrarNotaCredito(
  tx: Prisma.TransactionClient,
  input: { opticaId: string; pedidoId: string; pedidoNumero: string; devolucionId: string; importe: number },
  actor: ActorCuenta,
) {
  const cuenta = await cuentaDe(input.opticaId, tx);
  const mov = await tx.movimientoCuenta.create({
    data: {
      cuentaId: cuenta.id,
      tipo: 'NOTA_CREDITO',
      importe: -round2(input.importe),
      descripcion: `Nota de crédito por devolución del pedido ${input.pedidoNumero}`,
      pedidoMayoristaId: input.pedidoId,
      devolucionId: input.devolucionId,
      clave: `nc:${input.devolucionId}`,
      creadoPorId: actor.id,
      creadoPorNombre: actor.nombre,
    },
  });
  const pend = (await pedidosConDeuda(input.opticaId, tx)).find((p) => p.id === input.pedidoId);
  const monto = pend ? Math.min(pend.pendiente, round2(input.importe)) : 0;
  await imputar(tx, cuenta, { explicitas: { movimientoId: mov.id, items: monto > 0 ? [{ pedidoId: input.pedidoId, monto }] : [] }, actor });
  return mov;
}

// ------------------------------------------------------------------
// Liquidación mensual → crédito en la cuenta
// ------------------------------------------------------------------

/** Cierra un mes terminado: acredita la comisión de los pedidos web entregados en la cuenta de cada óptica. */
export async function cerrarLiquidacion(mes: string, actor: ActorCuenta, ahora = new Date()) {
  const r = rangoMes(mes);
  if (r.hasta > ahora) throw Errors.badRequest('Sólo se pueden cerrar meses terminados');
  const ya = await prisma.liquidacionCierre.findUnique({ where: { mes: r.mes } });
  if (ya) throw Errors.conflict(`La liquidación de ${r.mes} ya está cerrada`);
  const liq = await liquidacionGeneral(r.mes);
  const conComision = liq.items.filter((i) => i.comision > CENTAVO);
  try {
    return await prisma.$transaction(
      async (tx) => {
        const cierre = await tx.liquidacionCierre.create({
          data: { mes: r.mes, total: liq.totales.comision, cantidadOpticas: conComision.length, cerradoPorId: actor.id },
        });
        for (const i of conComision) {
          const cuenta = await cuentaDe(i.optica.id, tx);
          await tx.movimientoCuenta.create({
            data: {
              cuentaId: cuenta.id,
              tipo: 'CREDITO_LIQUIDACION',
              importe: -i.comision,
              descripcion: `Comisión de ${i.cantidad} pedido${i.cantidad === 1 ? '' : 's'} web entregado${i.cantidad === 1 ? '' : 's'} (${r.mes})`,
              liquidacionMes: r.mes,
              clave: `liq:${r.mes}:${i.optica.id}`,
              creadoPorId: actor.id,
              creadoPorNombre: actor.nombre,
            },
          });
          await imputar(tx, cuenta, { actor });
        }
        return {
          mes: cierre.mes,
          cerradoEn: cierre.cerradoEn,
          total: liq.totales.comision,
          acreditadas: conComision.map((i) => ({ opticaId: i.optica.id, nombre: i.optica.nombre, comision: i.comision })),
        };
      },
      { timeout: 60000 },
    );
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') throw Errors.conflict(`La liquidación de ${r.mes} ya está cerrada`);
    throw err;
  }
}

// ------------------------------------------------------------------
// Estado de cuenta
// ------------------------------------------------------------------

const movimientoInclude = {
  pedidoMayorista: { select: { id: true, numero: true } },
  imputaciones: { select: { monto: true, pedido: { select: { id: true, numero: true } } } },
} satisfies Prisma.MovimientoCuentaInclude;

type MovimientoFull = Prisma.MovimientoCuentaGetPayload<{ include: typeof movimientoInclude }>;

export function serializeMovimiento(m: MovimientoFull | (MovimientoCuenta & Partial<MovimientoFull>)) {
  return {
    id: m.id,
    tipo: m.tipo,
    tipoLabel: TIPO_MOVIMIENTO_LABEL[m.tipo],
    importe: dec(m.importe)!,
    fecha: m.fecha,
    descripcion: m.descripcion,
    motivo: m.motivo,
    medio: m.medio,
    referencia: m.referencia,
    comprobanteUrl: m.comprobanteUrl,
    vencimiento: m.vencimiento,
    liquidacionMes: m.liquidacionMes,
    pedido: m.pedidoMayorista ?? null,
    imputaciones: (m.imputaciones ?? []).map((i) => ({ pedidoId: i.pedido.id, numero: i.pedido.numero, monto: dec(i.monto)! })),
    creadoPorNombre: m.creadoPorNombre,
  };
}

/** Movimientos en orden cronológico con el saldo acumulado; el saldo final es la suma de todos. */
export async function estadoDeCuenta(opticaId: string, db: Db = prisma) {
  const cuenta = await cuentaDe(opticaId, db);
  const movs = await db.movimientoCuenta.findMany({
    where: { cuentaId: cuenta.id },
    include: movimientoInclude,
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
  });
  let saldo = 0;
  const movimientos = movs.map((m) => {
    saldo = round2(saldo + dec(m.importe)!);
    return { ...serializeMovimiento(m), saldo };
  });
  return { cuentaId: cuenta.id, movimientos, saldo };
}

export async function movimientosPaginados(opticaId: string, page: number, pageSize: number, tipo?: TipoMovimientoCuenta) {
  const { movimientos, saldo } = await estadoDeCuenta(opticaId);
  const filtrados = (tipo ? movimientos.filter((m) => m.tipo === tipo) : movimientos).reverse();
  const total = filtrados.length;
  return {
    items: filtrados.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    saldo,
  };
}

// ------------------------------------------------------------------
// Pagos informados por la óptica
// ------------------------------------------------------------------

export const pagoInformadoInclude = {
  optica: { select: { id: true, nombre: true } },
  movimiento: { select: { id: true, imputaciones: { select: { monto: true, pedido: { select: { id: true, numero: true } } } } } },
} satisfies Prisma.PagoInformadoInclude;

export function serializePagoInformado(p: Prisma.PagoInformadoGetPayload<{ include: typeof pagoInformadoInclude }>) {
  return {
    id: p.id,
    optica: p.optica,
    usuarioNombre: p.usuarioNombre,
    importe: dec(p.importe)!,
    medio: p.medio,
    fechaPago: p.fechaPago,
    referencia: p.referencia,
    comprobanteUrl: p.comprobanteUrl,
    comprobanteNombre: p.comprobanteNombre,
    notas: p.notas,
    pedidoIds: p.pedidoIds,
    estado: p.estado,
    motivoRechazo: p.motivoRechazo,
    revisadoEn: p.revisadoEn,
    createdAt: p.createdAt,
    imputaciones: (p.movimiento?.imputaciones ?? []).map((i) => ({ pedidoId: i.pedido.id, numero: i.pedido.numero, monto: dec(i.monto)! })),
  };
}

export async function informarPago(
  optica: { id: string },
  usuario: { id: string; nombre: string },
  input: {
    importe: number;
    medio: MedioPagoCuenta;
    fechaPago: Date;
    referencia?: string | null;
    comprobanteUrl: string;
    comprobanteNombre?: string | null;
    notas?: string | null;
    pedidoIds?: string[];
  },
) {
  const pedidoIds = [...new Set(input.pedidoIds ?? [])];
  if (pedidoIds.length) {
    const propios = await prisma.pedidoMayorista.count({ where: { id: { in: pedidoIds }, opticaId: optica.id } });
    if (propios !== pedidoIds.length) throw Errors.forbidden('Algún pedido no es de tu óptica');
  }
  return prisma.pagoInformado.create({
    data: {
      opticaId: optica.id,
      usuarioId: usuario.id,
      usuarioNombre: usuario.nombre,
      importe: round2(input.importe),
      medio: input.medio,
      fechaPago: input.fechaPago,
      referencia: input.referencia?.trim() || null,
      comprobanteUrl: input.comprobanteUrl,
      comprobanteNombre: input.comprobanteNombre ?? null,
      notas: input.notas?.trim() || null,
      pedidoIds,
    },
    include: pagoInformadoInclude,
  });
}

/** Valida el pago informado: genera el movimiento PAGO e imputa (lo indicado, o los pedidos que marcó la óptica). */
export async function validarPagoInformado(env: Env, id: string, actor: ActorCuenta, input: { imputaciones?: ImputacionInput[] }) {
  const pago = await prisma.$transaction(
    async (tx) => {
      const p = await tx.pagoInformado.findUnique({ where: { id } });
      if (!p) throw Errors.notFound('Pago informado no encontrado');
      const claim = await tx.pagoInformado.updateMany({ where: { id, estado: 'PENDIENTE' }, data: { estado: 'VALIDADO' } });
      if (claim.count === 0) throw Errors.conflict('Este pago ya fue revisado');
      const importe = dec(p.importe)!;
      let imputaciones = input.imputaciones;
      if (!imputaciones?.length && p.pedidoIds.length) {
        const pend = (await pedidosConDeuda(p.opticaId, tx)).filter((x) => p.pedidoIds.includes(x.id));
        let resto = importe;
        imputaciones = [];
        for (const x of pend) {
          if (resto <= CENTAVO) break;
          const m = round2(Math.min(resto, x.pendiente));
          imputaciones.push({ pedidoId: x.id, monto: m });
          resto = round2(resto - m);
        }
      }
      const mov = await registrarPagoTx(
        tx,
        p.opticaId,
        { importe, medio: p.medio, fecha: p.fechaPago, referencia: p.referencia, comprobanteUrl: p.comprobanteUrl, notas: p.notas, imputaciones },
        actor,
      );
      return tx.pagoInformado.update({
        where: { id },
        data: { movimientoId: mov.id, revisadoPorId: actor.id, revisadoEn: new Date() },
        include: { ...pagoInformadoInclude, optica: { select: { id: true, nombre: true, email: true } } },
      });
    },
    { timeout: 20000 },
  );
  await avisarPagoOptica(env, pago.opticaId, `Validamos tu pago de ${ars(dec(pago.importe)!)}`, `<p>Ya lo imputamos en tu cuenta corriente.</p>`);
  return pago;
}

export async function rechazarPagoInformado(env: Env, id: string, actor: ActorCuenta, motivo: string) {
  const claim = await prisma.pagoInformado.updateMany({
    where: { id, estado: 'PENDIENTE' },
    data: { estado: 'RECHAZADO', motivoRechazo: motivo, revisadoPorId: actor.id, revisadoEn: new Date() },
  });
  if (claim.count === 0) {
    const existe = await prisma.pagoInformado.count({ where: { id } });
    throw existe ? Errors.conflict('Este pago ya fue revisado') : Errors.notFound('Pago informado no encontrado');
  }
  const p = await prisma.pagoInformado.findUniqueOrThrow({ where: { id }, include: pagoInformadoInclude });
  await avisarPagoOptica(
    env,
    p.opticaId,
    `No pudimos validar tu pago de ${ars(dec(p.importe)!)}`,
    `<p>Motivo: ${escapar(motivo)}</p><p>Revisá el comprobante y volvé a informarlo desde tu cuenta.</p>`,
  );
  return p;
}

function escapar(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function avisarPagoOptica(env: Env, opticaId: string, titulo: string, cuerpo: string) {
  const o = await prisma.optica.findUnique({ where: { id: opticaId }, select: { email: true } });
  if (!o?.email) return;
  const web = env.WEB_URL.replace(/\/$/, '');
  await enviarEmail(
    env,
    { para: o.email, asunto: titulo, html: layoutEmail(env, { titulo, cuerpo, cta: { label: 'Ver mi cuenta', href: `${web}/optica/cuenta` } }) },
    { tipo: 'CUENTA_PAGO' },
  );
}

// ------------------------------------------------------------------
// Deuda global (dashboard y listado de cuentas)
// ------------------------------------------------------------------

export async function cuentasConSaldo(ahora = new Date()) {
  const opticas = await prisma.optica.findMany({
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, activa: true, cuentaCorriente: { select: { id: true, limiteCredito: true, plazoPagoDias: true } } },
  });
  const saldos = await prisma.movimientoCuenta.groupBy({ by: ['cuentaId'], _sum: { importe: true } });
  const saldoPorCuenta = new Map(saldos.map((s) => [s.cuentaId, round2(dec(s._sum.importe) ?? 0)]));
  const pendientes = await prisma.pedidoMayorista.findMany({
    where: { venceEn: { not: null, lt: ahora } },
    select: { opticaId: true, total: true, imputaciones: { select: { monto: true } } },
  });
  const vencidoPorOptica = new Map<string, number>();
  for (const p of pendientes) {
    const pend = dec(p.total)! - p.imputaciones.reduce((a, i) => a + dec(i.monto)!, 0);
    if (pend > CENTAVO) vencidoPorOptica.set(p.opticaId, (vencidoPorOptica.get(p.opticaId) ?? 0) + pend);
  }
  return opticas.map((o) => {
    const saldo = o.cuentaCorriente ? (saldoPorCuenta.get(o.cuentaCorriente.id) ?? 0) : 0;
    const limite = dec(o.cuentaCorriente?.limiteCredito) ?? 0;
    return {
      optica: { id: o.id, nombre: o.nombre, activa: o.activa },
      limiteCredito: limite,
      plazoPagoDias: o.cuentaCorriente?.plazoPagoDias ?? 30,
      saldo,
      deudaVencida: round2(Math.min(Math.max(saldo, 0), vencidoPorOptica.get(o.id) ?? 0)),
    };
  });
}

export async function totalesDeuda(ahora = new Date()) {
  const cuentas = await cuentasConSaldo(ahora);
  return {
    deudaTotal: round2(cuentas.reduce((a, c) => a + Math.max(c.saldo, 0), 0)),
    deudaVencida: round2(cuentas.reduce((a, c) => a + c.deudaVencida, 0)),
    opticasConDeudaVencida: cuentas.filter((c) => c.deudaVencida > CENTAVO).length,
  };
}

