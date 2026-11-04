// B2B 3: gestión de pedidos mayoristas en el backoffice.
//   PENDIENTE_APROBACION ─(regla de crédito)─▶ APROBADO | EN_REVISION ─(admin)─▶ APROBADO
//   APROBADO ─▶ EN_PREPARACION ─▶ DESPACHADO (envío por transporte) | LISTO_PARA_RETIRO (retiro) ─▶ ENTREGADO
//   CANCELADO desde cualquier estado anterior a la salida del depósito.
// Aprobar reserva stock (ReservaStock, el mismo de la tienda); cancelar la libera; la salida del depósito
// (despacho o listo para retirar) descuenta el stock, asigna número de remito y genera el débito en la
// cuenta corriente. Cada cambio queda en la línea de tiempo y se avisa por email a la óptica.
import { prisma } from '@vedere/db';
import type { EstadoPedidoMayorista, Prisma } from '@vedere/db';
import type { Env } from '../env.js';
import type { ActorCuenta } from './cuenta-corriente.js';
import { ars, cuentaDe, evaluarCredito, registrarDebito, registrarNotaCredito, resumenCuenta } from './cuenta-corriente.js';
import { emailAdmin, enviarEmail, layoutEmail } from './email.js';
import { AppError, Errors } from './errors.js';
import { DIAS_RESERVA_MAYORISTA, pedidoMayoristaDetalleInclude, round2 } from './mayorista.js';
import { disponibilidad } from './reservas.js';
import { dec } from './serialize.js';

type Tx = Prisma.TransactionClient;

export const ESTADO_LABEL: Record<EstadoPedidoMayorista, string> = {
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  EN_REVISION: 'En revisión',
  APROBADO: 'Aprobado',
  EN_PREPARACION: 'En preparación',
  LISTO_PARA_RETIRO: 'Listo para retirar',
  DESPACHADO: 'Despachado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

const CANCELABLES: EstadoPedidoMayorista[] = ['PENDIENTE_APROBACION', 'EN_REVISION', 'APROBADO', 'EN_PREPARACION'];
const DEVOLVIBLES: EstadoPedidoMayorista[] = ['LISTO_PARA_RETIRO', 'DESPACHADO', 'ENTREGADO'];

export const SISTEMA: ActorCuenta = { id: null, nombre: 'Sistema' };

async function cargar(id: string, db: Tx | typeof prisma = prisma) {
  const p = await db.pedidoMayorista.findUnique({ where: { id }, include: pedidoMayoristaDetalleInclude });
  if (!p) throw Errors.notFound('Pedido mayorista no encontrado');
  return p;
}
export type PedidoGestion = Awaited<ReturnType<typeof cargar>>;
export const cargarPedidoMayorista = cargar;

function exigir(p: { estado: EstadoPedidoMayorista }, estados: EstadoPedidoMayorista[], accion: string) {
  if (!estados.includes(p.estado)) {
    throw Errors.conflict(`No se puede ${accion} un pedido ${ESTADO_LABEL[p.estado].toLowerCase()}`);
  }
}

export async function registrarEvento(
  db: Tx | typeof prisma,
  pedidoId: string,
  e: { tipo: string; estado?: EstadoPedidoMayorista | null; nota?: string | null; interno?: boolean; actor?: ActorCuenta },
) {
  return db.eventoPedidoMayorista.create({
    data: {
      pedidoId,
      tipo: e.tipo,
      estado: e.estado ?? null,
      nota: e.nota ?? null,
      interno: e.interno ?? false,
      usuarioId: e.actor?.id ?? null,
      usuarioNombre: e.actor?.nombre ?? 'Sistema',
    },
  });
}

// ------------------------------------------------------------------
// Emails a la óptica
// ------------------------------------------------------------------

function esc(s: string | null | undefined) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function notificarOptica(env: Env, p: PedidoGestion, extra?: string) {
  const web = env.WEB_URL.replace(/\/$/, '');
  const label = ESTADO_LABEL[p.estado];
  const partes: string[] = [];
  switch (p.estado) {
    case 'PENDIENTE_APROBACION':
      partes.push('<p>Recibimos tu pedido y lo estamos revisando.</p>');
      break;
    case 'EN_REVISION':
      partes.push('<p>Recibimos tu pedido. Antes de aprobarlo lo revisa nuestro equipo comercial:</p>');
      if (p.motivoRevision) partes.push(`<p><strong>${esc(p.motivoRevision)}</strong></p>`);
      partes.push('<p>Te avisamos apenas lo aprobemos.</p>');
      break;
    case 'APROBADO':
      partes.push('<p>Aprobamos tu pedido y reservamos el stock. Lo empezamos a preparar.</p>');
      break;
    case 'EN_PREPARACION':
      partes.push('<p>Estamos preparando tu pedido.</p>');
      break;
    case 'LISTO_PARA_RETIRO':
      partes.push(`<p>Tu pedido está listo para retirar en <strong>${esc(p.direccionEntrega)}</strong>.</p>`);
      break;
    case 'DESPACHADO':
      partes.push('<p>Despachamos tu pedido.</p>');
      if (p.transporte) partes.push(`<p>Transporte: <strong>${esc(p.transporte)}</strong></p>`);
      if (p.numeroSeguimiento) partes.push(`<p>Número de guía: <strong>${esc(p.numeroSeguimiento)}</strong></p>`);
      if (p.linkSeguimiento) partes.push(`<p><a href="${esc(p.linkSeguimiento)}">Seguir el envío</a></p>`);
      break;
    case 'ENTREGADO':
      partes.push('<p>Registramos la entrega de tu pedido. ¡Gracias!</p>');
      break;
    case 'CANCELADO':
      partes.push('<p>Cancelamos tu pedido.</p>');
      if (p.motivoCancelacion) partes.push(`<p>Motivo: ${esc(p.motivoCancelacion)}</p>`);
      break;
  }
  if (p.venceEn && (p.estado === 'DESPACHADO' || p.estado === 'LISTO_PARA_RETIRO')) {
    partes.push(`<p>Total ${ars(dec(p.total)!)} con vencimiento el ${p.venceEn.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}.</p>`);
  }
  if (extra) partes.push(`<p>${esc(extra)}</p>`);
  const titulo = `Pedido ${p.numero}: ${label.toLowerCase()}`;
  await enviarEmail(
    env,
    {
      para: p.usuarioEmail,
      asunto: titulo,
      html: layoutEmail(env, { titulo, cuerpo: partes.join(''), cta: { label: 'Ver el pedido', href: `${web}/optica/compras/${p.id}` } }),
    },
    { tipo: `MAYORISTA_${p.estado}` },
  );
}

// ------------------------------------------------------------------
// Stock
// ------------------------------------------------------------------

async function reservarStock(tx: Tx, p: PedidoGestion) {
  const cantidades = new Map<string, number>();
  for (const i of p.items) if (i.varianteId) cantidades.set(i.varianteId, (cantidades.get(i.varianteId) ?? 0) + i.cantidad);
  const ids = [...cantidades.keys()];
  // Bloquea las variantes para que dos aprobaciones (o un pago web) no reserven el mismo stock.
  if (ids.length) await tx.$queryRawUnsafe(`SELECT id FROM variantes WHERE id = ANY($1::text[]) FOR UPDATE`, ids);
  const variantes = await tx.variante.findMany({ where: { id: { in: ids } }, select: { id: true, stock: true, sku: true } });
  const disp = await disponibilidad(variantes, tx);
  const faltantes = variantes
    .filter((v) => (disp.get(v.id) ?? 0) < (cantidades.get(v.id) ?? 0))
    .map((v) => ({ sku: v.sku, pedida: cantidades.get(v.id) ?? 0, disponible: disp.get(v.id) ?? 0 }));
  if (faltantes.length) {
    throw new AppError(
      409,
      'STOCK_INSUFICIENTE',
      `No hay stock para reservar: ${faltantes.map((f) => `${f.sku} (pide ${f.pedida}, hay ${f.disponible})`).join(', ')}`,
      { faltantes },
    );
  }
  const expiraEn = new Date(Date.now() + DIAS_RESERVA_MAYORISTA * 24 * 3600 * 1000);
  await tx.reservaStock.createMany({
    data: [...cantidades].map(([varianteId, cantidad]) => ({ pedidoMayoristaId: p.id, varianteId, cantidad, expiraEn })),
  });
}

/** Sale del depósito: descuenta stock (una sola vez), consume la reserva, numera el remito y debita la cuenta. */
async function salidaDeposito(tx: Tx, p: PedidoGestion, actor: ActorCuenta, ahora: Date) {
  if (!p.stockDescontado) {
    for (const i of p.items) {
      if (!i.varianteId) continue;
      await tx.variante.update({ where: { id: i.varianteId }, data: { stock: { decrement: i.cantidad } } });
    }
    await tx.reservaStock.updateMany({ where: { pedidoMayoristaId: p.id, estado: 'ACTIVA' }, data: { estado: 'CONSUMIDA' } });
    await tx.pedidoMayorista.update({ where: { id: p.id }, data: { stockDescontado: true } });
  }
  await asignarRemito(tx, p.id);
  return registrarDebito(tx, p, actor, ahora);
}

export async function asignarRemito(db: Tx | typeof prisma, pedidoId: string) {
  await db.$executeRawUnsafe(
    `UPDATE pedidos_mayoristas SET numero_remito = nextval('pedidos_mayoristas_remito_seq') WHERE id = $1 AND numero_remito IS NULL`,
    pedidoId,
  );
}

// ------------------------------------------------------------------
// Transiciones
// ------------------------------------------------------------------

async function transicion(
  env: Env,
  id: string,
  fn: (tx: Tx, p: PedidoGestion) => Promise<string | void>,
  opts: { notificar?: boolean } = {},
) {
  let extra: string | void = undefined;
  const final = await prisma.$transaction(
    async (tx) => {
      // Serializa transiciones concurrentes del mismo pedido.
      await tx.$queryRawUnsafe(`SELECT id FROM pedidos_mayoristas WHERE id = $1 FOR UPDATE`, id);
      const p = await cargar(id, tx);
      extra = await fn(tx, p);
      return cargar(id, tx);
    },
    { timeout: 30000 },
  );
  if (opts.notificar !== false) await notificarOptica(env, final, extra ?? undefined);
  return final;
}

/**
 * Regla de aprobación automática al confirmar: dentro del crédito disponible y sin deuda en mora →
 * APROBADO (reserva stock); si no, EN_REVISION con el motivo. Se evalúa con la cuenta bloqueada para que
 * dos pedidos simultáneos no usen el mismo crédito.
 */
export async function evaluarAprobacion(env: Env, id: string) {
  return transicion(env, id, async (tx, p) => {
    if (p.estado !== 'PENDIENTE_APROBACION') return;
    await cuentaDe(p.opticaId, tx);
    await tx.$queryRawUnsafe(`SELECT id FROM cuentas_corrientes WHERE optica_id = $1 FOR UPDATE`, p.opticaId);
    const resumen = await resumenCuenta(p.opticaId, { db: tx });
    const ev = evaluarCredito(resumen, dec(p.total)!);
    let motivo: string | null = ev.ok ? null : ev.motivo;
    if (ev.ok) {
      try {
        await reservarStock(tx, p);
      } catch (err) {
        if (!(err instanceof AppError) || err.code !== 'STOCK_INSUFICIENTE') throw err;
        motivo = err.message;
      }
    }
    if (motivo) {
      await tx.pedidoMayorista.update({ where: { id: p.id }, data: { estado: 'EN_REVISION', motivoRevision: motivo } });
      await registrarEvento(tx, p.id, { tipo: 'ESTADO', estado: 'EN_REVISION', nota: motivo });
    } else {
      await tx.pedidoMayorista.update({ where: { id: p.id }, data: { estado: 'APROBADO', aprobadoEn: new Date(), motivoRevision: null } });
      await registrarEvento(tx, p.id, { tipo: 'ESTADO', estado: 'APROBADO', nota: 'Aprobado automáticamente: dentro del crédito disponible' });
    }
  });
}

export async function aprobarPedidoMayorista(env: Env, id: string, actor: ActorCuenta, nota?: string | null) {
  return transicion(env, id, async (tx, p) => {
    exigir(p, ['PENDIENTE_APROBACION', 'EN_REVISION'], 'aprobar');
    await reservarStock(tx, p);
    await tx.pedidoMayorista.update({ where: { id: p.id }, data: { estado: 'APROBADO', aprobadoEn: new Date(), aprobadoPorId: actor.id } });
    await registrarEvento(tx, p.id, { tipo: 'ESTADO', estado: 'APROBADO', nota: nota || (p.estado === 'EN_REVISION' ? 'Aprobado por el admin' : null), actor });
  });
}

export async function prepararPedidoMayorista(env: Env, id: string, actor: ActorCuenta, nota?: string | null) {
  return transicion(env, id, async (tx, p) => {
    exigir(p, ['APROBADO'], 'pasar a preparación');
    await tx.pedidoMayorista.update({ where: { id: p.id }, data: { estado: 'EN_PREPARACION', enPreparacionEn: new Date() } });
    await registrarEvento(tx, p.id, { tipo: 'ESTADO', estado: 'EN_PREPARACION', nota: nota || null, actor });
  });
}

export interface DespachoInput {
  transporte: string;
  numeroSeguimiento?: string | null;
  linkSeguimiento?: string | null;
  nota?: string | null;
}

export async function despacharPedidoMayorista(env: Env, id: string, actor: ActorCuenta, input: DespachoInput, ahora = new Date()) {
  return transicion(env, id, async (tx, p) => {
    exigir(p, ['APROBADO', 'EN_PREPARACION'], 'despachar');
    if (p.entrega !== 'ENVIO_TRANSPORTE') throw Errors.conflict('Este pedido es para retirar en el depósito: marcalo como listo para retirar');
    await salidaDeposito(tx, p, actor, ahora);
    await tx.pedidoMayorista.update({
      where: { id: p.id },
      data: {
        estado: 'DESPACHADO',
        despachadoEn: ahora,
        transporte: input.transporte,
        numeroSeguimiento: input.numeroSeguimiento || null,
        linkSeguimiento: input.linkSeguimiento || null,
      },
    });
    const guia = [input.transporte, input.numeroSeguimiento ? `guía ${input.numeroSeguimiento}` : null].filter(Boolean).join(' · ');
    await registrarEvento(tx, p.id, { tipo: 'ESTADO', estado: 'DESPACHADO', nota: [guia, input.nota].filter(Boolean).join('. '), actor });
  });
}

export async function listoParaRetiroPedidoMayorista(env: Env, id: string, actor: ActorCuenta, nota?: string | null, ahora = new Date()) {
  return transicion(env, id, async (tx, p) => {
    exigir(p, ['APROBADO', 'EN_PREPARACION'], 'marcar como listo para retirar');
    if (p.entrega !== 'RETIRO_DEPOSITO') throw Errors.conflict('Este pedido va por transporte: despachalo');
    await salidaDeposito(tx, p, actor, ahora);
    await tx.pedidoMayorista.update({ where: { id: p.id }, data: { estado: 'LISTO_PARA_RETIRO', listoParaRetiroEn: ahora } });
    await registrarEvento(tx, p.id, { tipo: 'ESTADO', estado: 'LISTO_PARA_RETIRO', nota: nota || null, actor });
  });
}

export async function entregarPedidoMayorista(env: Env, id: string, actor: ActorCuenta, nota?: string | null) {
  return transicion(env, id, async (tx, p) => {
    exigir(p, ['DESPACHADO', 'LISTO_PARA_RETIRO'], 'marcar como entregado');
    await tx.pedidoMayorista.update({ where: { id: p.id }, data: { estado: 'ENTREGADO', entregadoEn: new Date() } });
    await registrarEvento(tx, p.id, { tipo: 'ESTADO', estado: 'ENTREGADO', nota: nota || null, actor });
  });
}

export async function cancelarPedidoMayorista(env: Env, id: string, actor: ActorCuenta, motivo: string) {
  return transicion(env, id, async (tx, p) => {
    exigir(p, CANCELABLES, 'cancelar');
    await tx.reservaStock.updateMany({ where: { pedidoMayoristaId: p.id, estado: 'ACTIVA' }, data: { estado: 'LIBERADA' } });
    await tx.pedidoMayorista.update({ where: { id: p.id }, data: { estado: 'CANCELADO', canceladoEn: new Date(), motivoCancelacion: motivo } });
    await registrarEvento(tx, p.id, { tipo: 'ESTADO', estado: 'CANCELADO', nota: motivo, actor });
  });
}

/** Notas internas, número de factura y notas en la línea de tiempo (no cambian el estado ni mandan email,
 *  salvo la factura, que se le avisa a la óptica). */
export async function actualizarPedidoMayorista(
  env: Env,
  id: string,
  actor: ActorCuenta,
  input: { notasInternas?: string | null; numeroFactura?: string | null; nota?: string | null; notaInterna?: boolean },
) {
  let avisarFactura = false;
  const p = await transicion(
    env,
    id,
    async (tx, p) => {
      const data: Prisma.PedidoMayoristaUpdateInput = {};
      if (input.notasInternas !== undefined && (input.notasInternas || null) !== p.notasInternas) {
        data.notasInternas = input.notasInternas || null;
        await registrarEvento(tx, p.id, { tipo: 'NOTA_INTERNA', nota: 'Actualizó las notas internas', interno: true, actor });
      }
      if (input.numeroFactura !== undefined && (input.numeroFactura || null) !== p.numeroFactura) {
        data.numeroFactura = input.numeroFactura || null;
        await registrarEvento(tx, p.id, {
          tipo: 'FACTURA',
          nota: input.numeroFactura ? `Factura ${input.numeroFactura}` : 'Se quitó el número de factura',
          actor,
        });
        avisarFactura = !!input.numeroFactura;
      }
      if (input.nota?.trim()) {
        await registrarEvento(tx, p.id, { tipo: 'NOTA', nota: input.nota.trim(), interno: input.notaInterna ?? true, actor });
      }
      if (Object.keys(data).length) await tx.pedidoMayorista.update({ where: { id: p.id }, data });
    },
    { notificar: false },
  );
  if (avisarFactura) {
    const web = env.WEB_URL.replace(/\/$/, '');
    const titulo = `Pedido ${p.numero}: factura ${p.numeroFactura}`;
    await enviarEmail(
      env,
      { para: p.usuarioEmail, asunto: titulo, html: layoutEmail(env, { titulo, cuerpo: `<p>Cargamos la factura <strong>${esc(p.numeroFactura)}</strong> de tu pedido.</p>`, cta: { label: 'Ver el pedido', href: `${web}/optica/compras/${p.id}` } }) },
      { tipo: 'MAYORISTA_FACTURA' },
    );
  }
  return p;
}

// ------------------------------------------------------------------
// Devoluciones
// ------------------------------------------------------------------

export interface SolicitudDevolucionInput {
  motivo: string;
  fotos: string[];
  items: Array<{ itemId: string; cantidad: number }>;
}

/** Ya devuelto o en trámite (no rechazado) por ítem del pedido. */
async function devueltoPorItem(db: Tx | typeof prisma, pedidoId: string) {
  const items = await db.devolucionMayoristaItem.findMany({
    where: { devolucion: { pedidoId, estado: { not: 'RECHAZADA' } } },
    select: { pedidoItemId: true, cantidad: true },
  });
  const m = new Map<string, number>();
  for (const i of items) m.set(i.pedidoItemId, (m.get(i.pedidoItemId) ?? 0) + i.cantidad);
  return m;
}

export async function solicitarDevolucion(
  env: Env,
  pedidoId: string,
  usuario: { id: string; nombre: string },
  input: SolicitudDevolucionInput,
) {
  const d = await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`SELECT id FROM pedidos_mayoristas WHERE id = $1 FOR UPDATE`, pedidoId);
    const p = await cargar(pedidoId, tx);
    if (!DEVOLVIBLES.includes(p.estado)) throw Errors.conflict('Sólo se pueden devolver pedidos despachados o entregados');
    const ya = await devueltoPorItem(tx, p.id);
    const filas = input.items.filter((i) => i.cantidad > 0);
    if (!filas.length) throw Errors.badRequest('Elegí qué modelos y cuántas unidades devolvés');
    let neto = 0;
    const data = filas.map((f) => {
      const item = p.items.find((i) => i.id === f.itemId);
      if (!item) throw Errors.badRequest('Ese modelo no es de este pedido');
      const max = item.cantidad - (ya.get(item.id) ?? 0);
      if (f.cantidad > max) throw Errors.badRequest(`De ${item.sku} podés devolver hasta ${max} unidad${max === 1 ? '' : 'es'}`);
      const total = round2(dec(item.precioUnitario)! * f.cantidad);
      neto += total;
      return { pedidoItemId: item.id, cantidad: f.cantidad, total };
    });
    const importe = round2(neto * (1 + dec(p.ivaPct)! / 100));
    const d = await tx.devolucionMayorista.create({
      data: {
        pedidoId: p.id,
        opticaId: p.opticaId,
        motivo: input.motivo,
        fotos: input.fotos,
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        importe,
        items: { create: data },
      },
    });
    await registrarEvento(tx, p.id, {
      tipo: 'DEVOLUCION',
      nota: `Devolución solicitada (${data.reduce((a, x) => a + x.cantidad, 0)} u., ${ars(importe)}): ${input.motivo}`,
      actor: { id: usuario.id, nombre: usuario.nombre },
    });
    return { d, numero: p.numero };
  });
  await emailAdmin(env, {
    tipo: 'MAYORISTA_DEVOLUCION',
    asunto: `Devolución solicitada del pedido ${d.numero}`,
    cuerpoHtml: `<p>${esc(usuario.nombre)} pidió devolver productos del pedido ${esc(d.numero)}.</p><p>Motivo: ${esc(input.motivo)}</p>`,
    href: `${env.WEB_URL.replace(/\/$/, '')}/admin/pedidos-mayoristas/${pedidoId}`,
  }).catch(() => undefined);
  return d.d;
}

export async function aprobarDevolucion(env: Env, devolucionId: string, actor: ActorCuenta) {
  const r = await prisma.$transaction(
    async (tx) => {
      const claim = await tx.devolucionMayorista.updateMany({
        where: { id: devolucionId, estado: 'SOLICITADA' },
        data: { estado: 'APROBADA', resueltoPorId: actor.id, resueltoEn: new Date() },
      });
      if (claim.count === 0) {
        const existe = await tx.devolucionMayorista.count({ where: { id: devolucionId } });
        throw existe ? Errors.conflict('Esta devolución ya fue resuelta') : Errors.notFound('Devolución no encontrada');
      }
      const d = await tx.devolucionMayorista.findUniqueOrThrow({
        where: { id: devolucionId },
        include: { items: { include: { pedidoItem: true } }, pedido: { select: { id: true, numero: true, opticaId: true } } },
      });
      // Reingreso de stock.
      for (const i of d.items) {
        if (i.pedidoItem.varianteId) {
          await tx.variante.update({ where: { id: i.pedidoItem.varianteId }, data: { stock: { increment: i.cantidad } } });
        }
      }
      await registrarNotaCredito(
        tx,
        { opticaId: d.opticaId, pedidoId: d.pedido.id, pedidoNumero: d.pedido.numero, devolucionId: d.id, importe: dec(d.importe)! },
        actor,
      );
      await registrarEvento(tx, d.pedido.id, {
        tipo: 'DEVOLUCION',
        nota: `Devolución aprobada: reingresó el stock y se emitió una nota de crédito por ${ars(dec(d.importe)!)}`,
        actor,
      });
      return d;
    },
    { timeout: 30000 },
  );
  const p = await cargar(r.pedido.id);
  const web = env.WEB_URL.replace(/\/$/, '');
  const titulo = `Aprobamos tu devolución del pedido ${p.numero}`;
  await enviarEmail(
    env,
    { para: p.usuarioEmail, asunto: titulo, html: layoutEmail(env, { titulo, cuerpo: `<p>Te acreditamos una nota de crédito por <strong>${ars(dec(r.importe)!)}</strong> en tu cuenta corriente.</p>`, cta: { label: 'Ver mi cuenta', href: `${web}/optica/cuenta` } }) },
    { tipo: 'MAYORISTA_DEVOLUCION_APROBADA' },
  );
  return r;
}

export async function rechazarDevolucion(env: Env, devolucionId: string, actor: ActorCuenta, motivo: string) {
  const claim = await prisma.devolucionMayorista.updateMany({
    where: { id: devolucionId, estado: 'SOLICITADA' },
    data: { estado: 'RECHAZADA', motivoRechazo: motivo, resueltoPorId: actor.id, resueltoEn: new Date() },
  });
  if (claim.count === 0) {
    const existe = await prisma.devolucionMayorista.count({ where: { id: devolucionId } });
    throw existe ? Errors.conflict('Esta devolución ya fue resuelta') : Errors.notFound('Devolución no encontrada');
  }
  const d = await prisma.devolucionMayorista.findUniqueOrThrow({ where: { id: devolucionId } });
  await registrarEvento(prisma, d.pedidoId, { tipo: 'DEVOLUCION', nota: `Devolución rechazada: ${motivo}`, actor });
  const p = await cargar(d.pedidoId);
  const web = env.WEB_URL.replace(/\/$/, '');
  const titulo = `No pudimos aceptar tu devolución del pedido ${p.numero}`;
  await enviarEmail(
    env,
    { para: p.usuarioEmail, asunto: titulo, html: layoutEmail(env, { titulo, cuerpo: `<p>Motivo: ${esc(motivo)}</p>`, cta: { label: 'Ver el pedido', href: `${web}/optica/compras/${p.id}` } }) },
    { tipo: 'MAYORISTA_DEVOLUCION_RECHAZADA' },
  );
  return d;
}
