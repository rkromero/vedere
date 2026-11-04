// Prompt 5: línea de tiempo del pedido (eventos), máquina de estados, plazo en horas hábiles y
// asignación automática / manual a la óptica socia más cercana con radio y capacidad diaria.
import { prisma } from '@vedere/db';
import type { EstadoPedido, Optica, Prisma, Rol } from '@vedere/db';
import type { Env } from '../env.js';
import { emailAdmin, emailEstadoCliente, emailOpticaNuevoPedido } from './email.js';
import { ejecutarPostPago } from './post-pago.js';
import type { PedidoParaEmail } from './email.js';
import { AppError, Errors } from './errors.js';
import { distanciaKm } from './geo.js';
import { condicionesDe, getConfigNiveles } from './niveles.js';
import { cargarConfig, pedidoInclude } from './pedidos.js';
import type { PedidoFull } from './pedidos.js';
import { dec } from './serialize.js';

type Db = Prisma.TransactionClient | typeof prisma;

// ---------- Actor y eventos ----------

export interface Actor {
  id: string | null;
  nombre: string | null;
  rol: Rol | null;
}

export const SISTEMA: Actor = { id: null, nombre: 'Sistema', rol: null };

/** Actor a partir del usuario autenticado (JWT). */
export function actorDe(user: { sub: string; email: string; rol: Rol; nombre?: string | null }): Actor {
  return { id: user.sub, nombre: user.nombre ?? user.email, rol: user.rol };
}

export interface EventoInput {
  pedidoId: string;
  tipo: 'ESTADO' | 'ASIGNACION' | 'RECHAZO' | 'NOTA' | 'EMAIL' | 'PAGO' | 'REEMBOLSO' | 'SOLICITUD';
  estadoAnterior?: EstadoPedido | null;
  estadoNuevo?: EstadoPedido | null;
  opticaId?: string | null;
  actor?: Actor;
  nota?: string | null;
  datos?: Prisma.InputJsonValue | null;
}

export async function registrarEvento(db: Db, e: EventoInput) {
  const actor = e.actor ?? SISTEMA;
  return db.pedidoEvento.create({
    data: {
      pedidoId: e.pedidoId,
      tipo: e.tipo,
      estadoAnterior: e.estadoAnterior ?? null,
      estadoNuevo: e.estadoNuevo ?? null,
      opticaId: e.opticaId ?? null,
      userId: actor.id,
      actorNombre: actor.nombre,
      actorRol: actor.rol,
      nota: e.nota ?? null,
      datos: e.datos ?? undefined,
    },
  });
}

// ---------- Horas hábiles (Argentina, UTC-3 sin horario de verano) ----------

const TZ_OFFSET_MS = -3 * 3600_000;

export interface ConfigHabil {
  horaHabilDesde: number;
  horaHabilHasta: number;
  sabadoHabil: boolean;
}

/** Suma `horas` hábiles a `desde` según el horario configurado. Domingos nunca cuentan. */
export function sumarHorasHabiles(desde: Date, horas: number, cfg: ConfigHabil): Date {
  const esHabil = (local: Date) => {
    const d = local.getUTCDay();
    if (d === 0) return false;
    if (d === 6) return cfg.sabadoHabil;
    return true;
  };
  const hasta = Math.max(cfg.horaHabilDesde + 1, cfg.horaHabilHasta);
  let t = desde.getTime() + TZ_OFFSET_MS;
  let restante = Math.max(0, horas) * 3600_000;
  let guard = 0;
  while (restante > 0 && guard++ < 400) {
    const local = new Date(t);
    const inicioDia = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    const apertura = inicioDia + cfg.horaHabilDesde * 3600_000;
    const cierre = inicioDia + hasta * 3600_000;
    if (!esHabil(local) || t >= cierre) {
      t = inicioDia + 24 * 3600_000 + cfg.horaHabilDesde * 3600_000;
      continue;
    }
    if (t < apertura) t = apertura;
    const disponible = cierre - t;
    if (disponible >= restante) {
      t += restante;
      restante = 0;
    } else {
      restante -= disponible;
      t = cierre;
    }
  }
  return new Date(t - TZ_OFFSET_MS);
}

/** Rango UTC del día local (Argentina) que contiene `ahora`. */
export function rangoDiaLocal(ahora = new Date()): { desde: Date; hasta: Date } {
  const local = new Date(ahora.getTime() + TZ_OFFSET_MS);
  const inicio = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return { desde: new Date(inicio - TZ_OFFSET_MS), hasta: new Date(inicio + 24 * 3600_000 - TZ_OFFSET_MS) };
}

// ---------- Elección de la óptica (función pura, testeable) ----------

export interface OpticaCandidata {
  id: string;
  nombre: string;
  lat: number | null;
  lng: number | null;
  radioKm: number;
  capacidadDiaria: number;
  activa: boolean;
  /** Pedidos asignados hoy. */
  asignadosHoy: number;
  /** B2B 4: prioridad por nivel (0 Vetro … 3 Zafiro): a igual distancia gana la de mayor nivel. */
  prioridadNivel?: number;
  /** B2B 4: radio (km) dentro del cual la óptica tiene prioridad sobre las demás. */
  radioExclusividadKm?: number;
}

export interface Evaluada<T extends OpticaCandidata = OpticaCandidata> {
  optica: T;
  distanciaKm: number | null;
  dentroRadio: boolean;
  conCupo: boolean;
  excluida: boolean;
  /** El cliente está dentro del radio de exclusividad de la óptica. */
  exclusiva: boolean;
  elegible: boolean;
}

/**
 * Evalúa y ordena las ópticas para el cliente. La primera `elegible` es la asignación automática.
 * Orden: primero las que tienen al cliente dentro de su radio de exclusividad (beneficio de nivel), después
 * por distancia; a igual distancia, la de mayor nivel; y por último por nombre.
 */
export function evaluarOpticas<T extends OpticaCandidata>(
  cliente: { lat: number | null; lng: number | null },
  opticas: T[],
  excluidas: string[] = [],
): Evaluada<T>[] {
  const out = opticas.map((o) => {
    const conCoords = cliente.lat !== null && cliente.lng !== null && o.lat !== null && o.lng !== null;
    const km = conCoords ? Math.round(distanciaKm(cliente.lat!, cliente.lng!, o.lat!, o.lng!) * 10) / 10 : null;
    const dentroRadio = km !== null && km <= o.radioKm;
    const conCupo = o.asignadosHoy < o.capacidadDiaria;
    const excluida = excluidas.includes(o.id);
    const exclusiva = km !== null && (o.radioExclusividadKm ?? 0) > 0 && km <= (o.radioExclusividadKm ?? 0);
    return { optica: o, distanciaKm: km, dentroRadio, conCupo, excluida, exclusiva, elegible: o.activa && dentroRadio && conCupo && !excluida };
  });
  out.sort(
    (a, b) =>
      Number(b.exclusiva) - Number(a.exclusiva) ||
      (a.distanciaKm ?? 1e9) - (b.distanciaKm ?? 1e9) ||
      (b.optica.prioridadNivel ?? 0) - (a.optica.prioridadNivel ?? 0) ||
      a.optica.nombre.localeCompare(b.optica.nombre, 'es'),
  );
  return out;
}

export function elegirOptica<T extends OpticaCandidata>(
  cliente: { lat: number | null; lng: number | null },
  opticas: T[],
  excluidas: string[] = [],
): Evaluada<T> | null {
  return evaluarOpticas(cliente, opticas, excluidas).find((e) => e.elegible) ?? null;
}

/** Todas las ópticas con su carga de hoy (para evaluar). */
export async function cargarCandidatas(
  db: Db = prisma,
  ahora = new Date(),
): Promise<Array<Optica & { asignadosHoy: number; prioridadNivel: number; radioExclusividadKm: number }>> {
  const { desde, hasta } = rangoDiaLocal(ahora);
  const [opticas, carga, cfg] = await Promise.all([
    db.optica.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }], include: { cuentaCorriente: { select: { limiteCredito: true, plazoPagoDias: true } } } }),
    db.pedido.groupBy({
      by: ['opticaId'],
      where: { opticaId: { not: null }, asignadoEn: { gte: desde, lt: hasta }, estado: { notIn: ['CANCELADO', 'DEVUELTO'] } },
      _count: { _all: true },
    }),
    getConfigNiveles(db),
  ]);
  const porOptica = new Map(carga.map((c) => [c.opticaId!, c._count._all]));
  return opticas.map(({ cuentaCorriente, ...o }) => {
    const cond = condicionesDe(o, cuentaCorriente, cfg, ahora);
    return { ...o, asignadosHoy: porOptica.get(o.id) ?? 0, prioridadNivel: cond.prioridad, radioExclusividadKm: cond.radioExclusividadKm };
  });
}

// ---------- Máquina de estados ----------

export const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  PENDIENTE_PAGO: ['PAGADO', 'CANCELADO'],
  PAGADO: ['ASIGNADO', 'CANCELADO'],
  ASIGNADO: ['ACEPTADO', 'PAGADO', 'CANCELADO'],
  ACEPTADO: ['EN_ARMADO', 'LISTO', 'CANCELADO'],
  EN_ARMADO: ['LISTO', 'CANCELADO'],
  LISTO: ['ENVIADO', 'ENTREGADO', 'CANCELADO'],
  ENVIADO: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO: ['DEVUELTO'],
  CANCELADO: [],
  DEVUELTO: [],
};

export function puedeTransicionar(de: EstadoPedido, a: EstadoPedido): boolean {
  return TRANSICIONES[de].includes(a);
}

export function pedidoParaEmail(p: PedidoFull): PedidoParaEmail {
  return {
    id: p.id,
    numero: p.numero,
    email: p.email,
    nombre: p.nombre,
    estado: p.estado,
    modalidad: p.modalidad,
    total: p.total,
    numeroSeguimiento: p.numeroSeguimiento,
    items: p.items.map((i) => ({ nombre: i.nombre, color: i.color, cantidad: i.cantidad })),
    optica: p.optica
      ? {
          nombre: p.optica.nombre,
          direccion: p.optica.direccion,
          localidad: p.optica.localidad,
          horarios: p.optica.horarios,
          whatsapp: p.optica.whatsapp,
          telefono: p.optica.telefono,
        }
      : null,
  };
}

export interface CambioEstadoOpts {
  env: Env;
  actor: Actor;
  nota?: string | null;
  datos?: Prisma.InputJsonValue | null;
  /** ENVIADO: número de seguimiento. */
  numeroSeguimiento?: string | null;
  /** Admin: saltea la validación de transiciones (queda registrado en el evento). */
  forzar?: boolean;
  /** No mandar email al cliente (ej. cambios internos). */
  sinEmail?: boolean;
}

/**
 * Cambia el estado del pedido validando la transición, registra el evento (quién, cuándo, nota)
 * y dispara el email correspondiente al cliente. CANCELADO va por `cancelarPedido` (repone stock).
 */
export async function cambiarEstado(pedidoId: string, nuevo: EstadoPedido, opts: CambioEstadoOpts): Promise<PedidoFull> {
  if (nuevo === 'CANCELADO') throw Errors.badRequest('Para cancelar usá la acción de cancelación');
  const pedido = await prisma.$transaction(async (tx) => {
    const actual = await tx.pedido.findUnique({ where: { id: pedidoId }, include: { optica: true } });
    if (!actual) throw Errors.notFound('Pedido no encontrado');
    if (actual.estado === nuevo) return tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: pedidoInclude });
    if (!opts.forzar && !puedeTransicionar(actual.estado, nuevo)) {
      throw new AppError(409, 'TRANSICION_INVALIDA', `El pedido está ${etiquetaEstado(actual.estado)} y no puede pasar a ${etiquetaEstado(nuevo)}`);
    }
    const ahora = new Date();
    const data: Prisma.PedidoUpdateInput = { estado: nuevo };
    if (nuevo === 'ACEPTADO') data.aceptadoEn = ahora;
    if (nuevo === 'ENVIADO') {
      data.enviadoEn = ahora;
      if (opts.numeroSeguimiento !== undefined) data.numeroSeguimiento = opts.numeroSeguimiento;
    }
    if (nuevo === 'ENTREGADO') {
      data.entregadoEn = ahora;
      const pct = dec(actual.comisionPct) ?? dec(actual.optica?.comisionPct) ?? 0;
      data.comisionPct = pct;
      data.comisionMonto = Math.round((dec(actual.total) ?? 0) * pct) / 100;
    }
    await tx.pedido.update({ where: { id: pedidoId }, data });
    await registrarEvento(tx, {
      pedidoId,
      tipo: 'ESTADO',
      estadoAnterior: actual.estado,
      estadoNuevo: nuevo,
      opticaId: actual.opticaId,
      actor: opts.actor,
      nota: opts.nota ?? null,
      datos: {
        ...(opts.datos && typeof opts.datos === 'object' ? (opts.datos as object) : {}),
        ...(opts.forzar ? { forzado: true } : {}),
        ...(opts.numeroSeguimiento ? { numeroSeguimiento: opts.numeroSeguimiento } : {}),
      },
    });
    return tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: pedidoInclude });
  });
  if (!opts.sinEmail && pedido.estado === nuevo) {
    await emailEstadoCliente(opts.env, pedidoParaEmail(pedido), nuevo, { nota: opts.nota ?? null });
  }
  return pedido;
}

export function etiquetaEstado(e: EstadoPedido): string {
  const l: Record<EstadoPedido, string> = {
    PENDIENTE_PAGO: 'pendiente de pago',
    PAGADO: 'pagado (sin asignar)',
    ASIGNADO: 'asignado',
    ACEPTADO: 'aceptado',
    EN_ARMADO: 'en armado',
    LISTO: 'listo',
    ENVIADO: 'enviado',
    ENTREGADO: 'entregado',
    CANCELADO: 'cancelado',
    DEVUELTO: 'devuelto',
  };
  return l[e];
}

// ---------- Asignación ----------

export interface ResultadoAsignacion {
  pedido: PedidoFull;
  optica: Optica | null;
  distanciaKm: number | null;
}

const ESTADOS_ASIGNABLES: EstadoPedido[] = ['PAGADO', 'ASIGNADO', 'ACEPTADO', 'EN_ARMADO'];

async function aplicarAsignacion(
  tx: Prisma.TransactionClient,
  input: { pedidoId: string; optica: Optica; estadoAnterior: EstadoPedido; actor: Actor; nota: string; datos: Prisma.InputJsonValue },
) {
  const cfg = await cargarConfig(tx);
  const ahora = new Date();
  const aceptarAntesDe = sumarHorasHabiles(ahora, cfg.plazoAceptacionHoras, cfg);
  await tx.pedido.update({
    where: { id: input.pedidoId },
    data: {
      opticaId: input.optica.id,
      estado: 'ASIGNADO',
      asignadoEn: ahora,
      aceptarAntesDe,
      aceptadoEn: null,
      comisionPct: input.optica.comisionPct,
    },
  });
  await registrarEvento(tx, {
    pedidoId: input.pedidoId,
    tipo: 'ASIGNACION',
    estadoAnterior: input.estadoAnterior,
    estadoNuevo: 'ASIGNADO',
    opticaId: input.optica.id,
    actor: input.actor,
    nota: input.nota,
    datos: input.datos,
  });
  return aceptarAntesDe;
}

async function notificarAsignacion(env: Env, pedido: PedidoFull, aceptarAntesDe: Date | null) {
  await emailEstadoCliente(env, pedidoParaEmail(pedido), 'ASIGNADO');
  if (pedido.optica) {
    await emailOpticaNuevoPedido(env, { pedido: pedidoParaEmail(pedido), optica: pedido.optica, aceptarAntesDe });
  }
}

/**
 * Asigna el pedido a la óptica activa más cercana que lo tenga dentro de su radio y con capacidad
 * disponible hoy (excluyendo las que ya lo rechazaron). Sin dirección geocodificada, usa la óptica
 * elegida en el checkout si califica. Si nadie cubre, queda PAGADO sin óptica y se avisa al admin.
 */
export async function asignarAutomatico(
  pedidoId: string,
  opts: { env: Env; actor?: Actor; motivo?: string | null },
): Promise<ResultadoAsignacion> {
  const actor = opts.actor ?? SISTEMA;
  const r = await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw Errors.notFound('Pedido no encontrado');
    if (!ESTADOS_ASIGNABLES.includes(pedido.estado)) {
      throw new AppError(409, 'TRANSICION_INVALIDA', `El pedido está ${etiquetaEstado(pedido.estado)} y no se puede asignar`);
    }
    const candidatas = await cargarCandidatas(tx);
    const excluidas = pedido.opticasExcluidas;
    let elegida: Evaluada<Optica & { asignadosHoy: number }> | null = elegirOptica(
      { lat: pedido.lat, lng: pedido.lng },
      candidatas,
      excluidas,
    );
    let criterio: 'distancia' | 'checkout' = 'distancia';
    if (!elegida && (pedido.lat === null || pedido.lng === null) && pedido.opticaId) {
      // Sin coordenadas: la óptica elegida por el cliente en el checkout, si está activa y con cupo.
      const pref = candidatas.find((o) => o.id === pedido.opticaId);
      if (pref && pref.activa && pref.asignadosHoy < pref.capacidadDiaria && !excluidas.includes(pref.id)) {
        elegida = { optica: pref, distanciaKm: null, dentroRadio: false, conCupo: true, excluida: false, exclusiva: false, elegible: true };
        criterio = 'checkout';
      }
    }
    if (!elegida) {
      await tx.pedido.update({
        where: { id: pedidoId },
        data: { opticaId: null, estado: 'PAGADO', asignadoEn: null, aceptarAntesDe: null, aceptadoEn: null },
      });
      await registrarEvento(tx, {
        pedidoId,
        tipo: 'ASIGNACION',
        estadoAnterior: pedido.estado,
        estadoNuevo: 'PAGADO',
        actor,
        nota: opts.motivo ?? 'Sin asignar: ninguna óptica activa cubre la dirección con capacidad disponible hoy',
        datos: { sinAsignar: true, excluidas },
      });
      const p = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: pedidoInclude });
      return { pedido: p, optica: null as Optica | null, distanciaKm: null as number | null, aceptarAntesDe: null as Date | null };
    }
    const nota =
      opts.motivo ??
      (criterio === 'distancia'
        ? `Asignación automática: ${elegida.optica.nombre} a ${elegida.distanciaKm} km (radio ${elegida.optica.radioKm} km)`
        : `Asignación automática: ${elegida.optica.nombre} (óptica elegida en el checkout; dirección sin coordenadas)`);
    const aceptarAntesDe = await aplicarAsignacion(tx, {
      pedidoId,
      optica: elegida.optica,
      estadoAnterior: pedido.estado,
      actor,
      nota,
      datos: { automatica: true, criterio, distanciaKm: elegida.distanciaKm, excluidas },
    });
    const p = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: pedidoInclude });
    return { pedido: p, optica: elegida.optica as Optica, distanciaKm: elegida.distanciaKm, aceptarAntesDe };
  });

  if (r.optica) {
    await notificarAsignacion(opts.env, r.pedido, r.aceptarAntesDe);
  } else {
    await emailAdmin(opts.env, {
      tipo: 'ADMIN_SIN_ASIGNAR',
      asunto: `Pedido ${r.pedido.numero} sin óptica asignada`,
      cuerpoHtml: `<p>Ninguna óptica activa cubre la dirección <strong>${r.pedido.direccion}, ${r.pedido.localidad}</strong> con capacidad disponible hoy. Asignalo a mano desde el backoffice.</p>`,
      pedidoId: r.pedido.id,
    });
  }
  return { pedido: r.pedido, optica: r.optica, distanciaKm: r.distanciaKm };
}

/** Reasignación manual del admin: queda registrado quién y por qué. */
export async function asignarManual(
  pedidoId: string,
  opticaId: string,
  opts: { env: Env; actor: Actor; motivo: string },
): Promise<ResultadoAsignacion> {
  const r = await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({ where: { id: pedidoId }, include: { optica: true } });
    if (!pedido) throw Errors.notFound('Pedido no encontrado');
    if (!ESTADOS_ASIGNABLES.includes(pedido.estado)) {
      throw new AppError(409, 'TRANSICION_INVALIDA', `El pedido está ${etiquetaEstado(pedido.estado)} y no se puede reasignar`);
    }
    const optica = await tx.optica.findUnique({ where: { id: opticaId } });
    if (!optica) throw Errors.badRequest('Óptica inexistente', [{ path: 'opticaId', message: 'Elegí una óptica válida' }]);
    if (!optica.activa) throw Errors.badRequest('La óptica está pausada', [{ path: 'opticaId', message: 'Elegí una óptica activa' }]);
    if (pedido.opticaId === optica.id && pedido.estado !== 'PAGADO') {
      throw Errors.badRequest('El pedido ya está asignado a esa óptica');
    }
    const km =
      pedido.lat !== null && pedido.lng !== null && optica.lat !== null && optica.lng !== null
        ? Math.round(distanciaKm(pedido.lat, pedido.lng, optica.lat, optica.lng) * 10) / 10
        : null;
    const aceptarAntesDe = await aplicarAsignacion(tx, {
      pedidoId,
      optica,
      estadoAnterior: pedido.estado,
      actor: opts.actor,
      nota: opts.motivo,
      datos: { manual: true, distanciaKm: km, anteriorOpticaId: pedido.opticaId, anteriorOptica: pedido.optica?.nombre ?? null },
    });
    const p = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: pedidoInclude });
    return { pedido: p, optica, distanciaKm: km, aceptarAntesDe };
  });
  await notificarAsignacion(opts.env, r.pedido, r.aceptarAntesDe);
  return { pedido: r.pedido, optica: r.optica, distanciaKm: r.distanciaKm };
}

/** La óptica rechaza (o deja vencer) el pedido: se la excluye y se busca la siguiente más cercana. */
export async function rechazarAsignacion(
  pedidoId: string,
  opts: { env: Env; actor: Actor; opticaId: string; motivo: string; vencido?: boolean },
): Promise<ResultadoAsignacion> {
  await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({ where: { id: pedidoId }, include: { optica: true } });
    if (!pedido) throw Errors.notFound('Pedido no encontrado');
    if (pedido.opticaId !== opts.opticaId) throw Errors.forbidden('El pedido no está asignado a esta óptica');
    if (pedido.estado !== 'ASIGNADO' && pedido.estado !== 'ACEPTADO') {
      throw new AppError(409, 'TRANSICION_INVALIDA', `El pedido está ${etiquetaEstado(pedido.estado)} y ya no se puede rechazar`);
    }
    await tx.pedido.update({
      where: { id: pedidoId },
      data: { opticasExcluidas: { push: opts.opticaId }, estado: 'PAGADO', aceptarAntesDe: null, aceptadoEn: null },
    });
    await registrarEvento(tx, {
      pedidoId,
      tipo: 'RECHAZO',
      estadoAnterior: pedido.estado,
      estadoNuevo: 'PAGADO',
      opticaId: opts.opticaId,
      actor: opts.actor,
      nota: opts.vencido ? `Plazo de aceptación vencido en ${pedido.optica?.nombre ?? 'la óptica'}` : `Rechazado por ${pedido.optica?.nombre ?? 'la óptica'}: ${opts.motivo}`,
      datos: { vencido: !!opts.vencido, motivo: opts.motivo },
    });
  });
  return asignarAutomatico(pedidoId, { env: opts.env, actor: SISTEMA });
}

/** Pedidos ASIGNADOS cuyo plazo de aceptación venció: pasan a la siguiente óptica más cercana. */
export async function procesarVencidos(env: Env, ahora = new Date()): Promise<number> {
  const vencidos = await prisma.pedido.findMany({
    where: { estado: 'ASIGNADO', aceptarAntesDe: { lt: ahora }, opticaId: { not: null } },
    select: { id: true, opticaId: true },
    take: 100,
  });
  let n = 0;
  for (const p of vencidos) {
    try {
      await rechazarAsignacion(p.id, { env, actor: SISTEMA, opticaId: p.opticaId!, motivo: 'Plazo vencido', vencido: true });
      n++;
    } catch {
      /* se reintenta en la próxima pasada */
    }
  }
  return n;
}

/** Se llama una sola vez cuando el pago queda aprobado: email de pago y asignación automática. */
export async function onPagoAprobado(pedido: PedidoFull, env: Env, actor: Actor = SISTEMA): Promise<PedidoFull> {
  await emailEstadoCliente(env, pedidoParaEmail(pedido), 'PAGADO');
  // Prompt 6: referidos y conversiones server-side (nunca frenan el pedido).
  await ejecutarPostPago(pedido, env);
  if (pedido.estado !== 'PAGADO') return pedido;
  try {
    const r = await asignarAutomatico(pedido.id, { env, actor });
    return r.pedido;
  } catch {
    return pedido;
  }
}
