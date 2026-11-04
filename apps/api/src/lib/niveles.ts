// B2B 4: niveles y logros de las ópticas socias.
// - Puntaje de 12 meses móviles: cuatro variables (unidades ponderadas por línea, unidades por compra,
//   meses con actividad y días desde la última actividad) dan de 1 a 5 puntos según rangos editables;
//   puntaje = Σ(puntos × peso) × 20, más hasta N puntos extra por logros del último año.
// - Reglas: para subir se exige calidad en pedidos web; para bajar hay meses de gracia; sin actividad
//   por más de 90 días vuelve a Vetro. Nivel manual con motivo y vencimiento.
// - Beneficios (descuento, crédito, plazo, exclusividad, acceso anticipado) se calculan siempre desde el
//   nivel vigente: los valores de la óptica (descuentoPct, límite y plazo de la cuenta) son excepciones.
// Las funciones puras (puntaje, nivel, sugerencia, decisión) no tocan la base y tienen tests unitarios.
import { prisma } from '@vedere/db';
import type { Linea, NivelOptica, Optica, Prisma, TipoLogro } from '@vedere/db';
import { z } from 'zod';
import type { Env } from '../env.js';
import { enviarEmail, layoutEmail } from './email.js';
import { dec } from './serialize.js';

type Db = Prisma.TransactionClient | typeof prisma;

const DIA = 24 * 3600_000;
const TZ_MS = -3 * 3600_000;

export const NIVELES: NivelOptica[] = ['VETRO', 'CRISTALLO', 'PRISMA', 'ZAFIRO'];

export const NIVEL_INFO: Record<NivelOptica, { nombre: string; color: string }> = {
  VETRO: { nombre: 'Vetro', color: '#F2F2F0' },
  CRISTALLO: { nombre: 'Cristallo', color: '#7FD1C1' },
  PRISMA: { nombre: 'Prisma', color: '#3A5BD9' },
  ZAFIRO: { nombre: 'Zafiro', color: '#0A0A0A' },
};

export const LOGROS: TipoLogro[] = ['PRIMER_FOCO', 'MANO_FIRME', 'MULTIFOCAL_MAESTRO', 'RELOJITO', 'VITRINA_VEDERE', 'EMBAJADORA'];

export const LOGRO_INFO: Record<TipoLogro, { nombre: string; descripcion: string }> = {
  PRIMER_FOCO: { nombre: 'Primer foco', descripcion: 'Tu primer pedido mayorista despachado.' },
  MANO_FIRME: { nombre: 'Mano firme', descripcion: '50 pedidos web entregados sin reclamos.' },
  MULTIFOCAL_MAESTRO: { nombre: 'Multifocal maestro', descripcion: '20 multifocales entregados sin pedidos de cambio.' },
  RELOJITO: { nombre: 'Relojito', descripcion: '3 meses seguidos con el 100% de los pedidos web a tiempo.' },
  VITRINA_VEDERE: { nombre: 'Vitrina Vedere', descripcion: 'Muestrario Vedere en el local y fotos de la vitrina cargadas.' },
  EMBAJADORA: { nombre: 'Embajadora', descripcion: 'Recomendaste una óptica que se sumó a la red.' },
};

export const VARIABLES = ['total', 'porCompra', 'frecuencia', 'recencia'] as const;
export type Variable = (typeof VARIABLES)[number];

export const VARIABLE_INFO: Record<Variable, { nombre: string; unidad: string }> = {
  total: { nombre: 'Unidades en 12 meses', unidad: 'unidades' },
  porCompra: { nombre: 'Unidades por compra', unidad: 'unidades por pedido' },
  frecuencia: { nombre: 'Meses con actividad', unidad: 'meses de 12' },
  recencia: { nombre: 'Última actividad', unidad: 'días' },
};

/** Mínimo de fotos de la vitrina para el logro Vitrina Vedere. */
export const FOTOS_VITRINA_MIN = 3;

// ------------------------------------------------------------------
// Configuración
// ------------------------------------------------------------------

const num = z.number().finite();
const cortes4 = z.array(num.min(0)).length(4);
const beneficioSchema = z.object({
  descuentoPct: num.min(0).max(90),
  limiteCredito: num.min(0).max(1_000_000_000),
  plazoPagoDias: z.number().int().min(0).max(180),
  radioExclusividadKm: num.min(0).max(100),
  accesoAnticipadoDias: z.number().int().min(0).max(180),
});
export type Beneficios = z.infer<typeof beneficioSchema>;

export const configNivelesSchema = z
  .object({
    cortes: z.object({ CRISTALLO: num.min(1).max(100), PRISMA: num.min(1).max(100), ZAFIRO: num.min(1).max(100) }),
    pesos: z.object({ total: num.min(0).max(1), porCompra: num.min(0).max(1), frecuencia: num.min(0).max(1), recencia: num.min(0).max(1) }),
    /** Cortes que dan 2, 3, 4 y 5 puntos. Total, por compra y frecuencia: valor ≥ corte. Recencia: días ≤ corte. */
    rangos: z.object({ total: cortes4, porCompra: cortes4, frecuencia: cortes4, recencia: cortes4 }),
    ponderacionLinea: z.object({ SOL: num.min(0).max(10), RECETADO: num.min(0).max(10), MULTIFOCAL: num.min(0).max(10), ACCESORIO: num.min(0).max(10) }),
    beneficios: z.object({ VETRO: beneficioSchema, CRISTALLO: beneficioSchema, PRISMA: beneficioSchema, ZAFIRO: beneficioSchema }),
    logros: z.object({
      PRIMER_FOCO: z.number().int().min(0).max(5),
      MANO_FIRME: z.number().int().min(0).max(5),
      MULTIFOCAL_MAESTRO: z.number().int().min(0).max(5),
      RELOJITO: z.number().int().min(0).max(5),
      VITRINA_VEDERE: z.number().int().min(0).max(5),
      EMBAJADORA: z.number().int().min(0).max(5),
    }),
    maxPuntosLogrosAnio: z.number().int().min(0).max(20),
    mesesGracia: z.number().int().min(0).max(12),
    diasInactividad: z.number().int().min(1).max(365),
    minATiempoPct: num.min(0).max(100),
    minSatisfaccion: num.min(1).max(5),
    mesesBeneficioNuevas: z.number().int().min(0).max(24),
  })
  .superRefine((c, ctx) => {
    if (!(c.cortes.CRISTALLO < c.cortes.PRISMA && c.cortes.PRISMA < c.cortes.ZAFIRO)) {
      ctx.addIssue({ code: 'custom', path: ['cortes'], message: 'Los cortes tienen que ser crecientes (Cristallo < Prisma < Zafiro)' });
    }
    const suma = c.pesos.total + c.pesos.porCompra + c.pesos.frecuencia + c.pesos.recencia;
    if (Math.abs(suma - 1) > 0.001) ctx.addIssue({ code: 'custom', path: ['pesos'], message: 'Los pesos tienen que sumar 100%' });
    for (const v of ['total', 'porCompra', 'frecuencia'] as const) {
      const r = c.rangos[v];
      if (r.some((x, i) => i > 0 && x <= r[i - 1]!)) ctx.addIssue({ code: 'custom', path: ['rangos', v], message: 'Los cortes tienen que ser crecientes' });
    }
    const rr = c.rangos.recencia;
    if (rr.some((x, i) => i > 0 && x >= rr[i - 1]!)) {
      ctx.addIssue({ code: 'custom', path: ['rangos', 'recencia'], message: 'Los días tienen que ser decrecientes (más reciente = más puntos)' });
    }
  });
export type ConfigNiveles = z.infer<typeof configNivelesSchema>;

export const CONFIG_NIVELES_DEFAULT: ConfigNiveles = {
  cortes: { CRISTALLO: 40, PRISMA: 60, ZAFIRO: 80 },
  pesos: { total: 0.35, porCompra: 0.2, frecuencia: 0.25, recencia: 0.2 },
  rangos: {
    total: [60, 150, 300, 600], // <60, 60-149, 150-299, 300-599, 600+
    porCompra: [3, 6, 11, 21], // <3, 3-5, 6-10, 11-20, >20
    frecuencia: [4, 6, 9, 11], // 1-3, 4-5, 6-8, 9-10, 11-12
    recencia: [90, 60, 30, 14], // >90, 61-90, 31-60, 15-30, <15
  },
  ponderacionLinea: { SOL: 1, RECETADO: 1, MULTIFOCAL: 2, ACCESORIO: 0.25 },
  beneficios: {
    VETRO: { descuentoPct: 0, limiteCredito: 500_000, plazoPagoDias: 0, radioExclusividadKm: 0, accesoAnticipadoDias: 0 },
    CRISTALLO: { descuentoPct: 5, limiteCredito: 1_500_000, plazoPagoDias: 15, radioExclusividadKm: 0, accesoAnticipadoDias: 0 },
    PRISMA: { descuentoPct: 10, limiteCredito: 4_000_000, plazoPagoDias: 30, radioExclusividadKm: 1, accesoAnticipadoDias: 7 },
    ZAFIRO: { descuentoPct: 15, limiteCredito: 8_000_000, plazoPagoDias: 45, radioExclusividadKm: 2, accesoAnticipadoDias: 15 },
  },
  logros: { PRIMER_FOCO: 1, MANO_FIRME: 2, MULTIFOCAL_MAESTRO: 2, RELOJITO: 2, VITRINA_VEDERE: 1, EMBAJADORA: 2 },
  maxPuntosLogrosAnio: 5,
  mesesGracia: 2,
  diasInactividad: 90,
  minATiempoPct: 90,
  minSatisfaccion: 4.5,
  mesesBeneficioNuevas: 3,
};

function mezclar(base: ConfigNiveles, datos: unknown): ConfigNiveles {
  if (!datos || typeof datos !== 'object') return base;
  const d = datos as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(base) as Array<keyof ConfigNiveles>) {
    const v = d[k];
    if (v === undefined) continue;
    const b = base[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v) ? { ...(b as object), ...(v as object) } : v;
  }
  const r = configNivelesSchema.safeParse(out);
  return r.success ? r.data : base;
}

export async function getConfigNiveles(db: Db = prisma): Promise<ConfigNiveles> {
  const row = await db.configNiveles.findUnique({ where: { id: 'default' } });
  return mezclar(CONFIG_NIVELES_DEFAULT, row?.datos);
}

export async function guardarConfigNiveles(cfg: ConfigNiveles, db: Db = prisma) {
  const datos = cfg as unknown as Prisma.InputJsonValue;
  await db.configNiveles.upsert({ where: { id: 'default' }, create: { id: 'default', datos }, update: { datos } });
  return cfg;
}

// ------------------------------------------------------------------
// Puntaje (funciones puras)
// ------------------------------------------------------------------

export interface Metricas {
  /** Unidades ponderadas por línea: mayoristas despachados + pedidos web entregados, 12 meses. */
  unidades: number;
  /** Promedio de unidades por pedido mayorista despachado en 12 meses. */
  porCompra: number;
  pedidosMayoristas: number;
  unidadesMayoristas: number;
  /** Meses (de 12) con actividad. */
  meses: number;
  /** Días desde la última actividad; null si nunca tuvo. */
  diasSinActividad: number | null;
  ultimaActividad: string | null;
}

export function puntosVariable(variable: Variable, valor: number | null, cfg: ConfigNiveles): number {
  const cortes = cfg.rangos[variable];
  if (variable === 'recencia') {
    if (valor === null) return 1;
    return 1 + cortes.filter((c) => valor <= c).length;
  }
  return 1 + cortes.filter((c) => (valor ?? 0) >= c).length;
}

export function valorVariable(variable: Variable, m: Metricas): number | null {
  switch (variable) {
    case 'total':
      return m.unidades;
    case 'porCompra':
      return m.porCompra;
    case 'frecuencia':
      return m.meses;
    case 'recencia':
      return m.diasSinActividad;
  }
}

export interface Puntaje {
  puntos: Record<Variable, number>;
  /** Puntaje por las variables (0 a 100). */
  base: number;
  puntosExtra: number;
  /** base + extra, tope 100. */
  puntaje: number;
}

export function calcularPuntaje(m: Metricas, cfg: ConfigNiveles, puntosExtra = 0): Puntaje {
  const puntos = Object.fromEntries(VARIABLES.map((v) => [v, puntosVariable(v, valorVariable(v, m), cfg)])) as Record<Variable, number>;
  const base = Math.round(VARIABLES.reduce((a, v) => a + puntos[v] * cfg.pesos[v], 0) * 20 * 100) / 100;
  const baseRedondeada = Math.round(base);
  return { puntos, base: baseRedondeada, puntosExtra, puntaje: Math.min(100, baseRedondeada + puntosExtra) };
}

export function nivelPorPuntaje(puntaje: number, cfg: ConfigNiveles): NivelOptica {
  if (puntaje >= cfg.cortes.ZAFIRO) return 'ZAFIRO';
  if (puntaje >= cfg.cortes.PRISMA) return 'PRISMA';
  if (puntaje >= cfg.cortes.CRISTALLO) return 'CRISTALLO';
  return 'VETRO';
}

export const rangoNivel = (n: NivelOptica) => NIVELES.indexOf(n);
export const maxNivel = (a: NivelOptica, b: NivelOptica) => (rangoNivel(a) >= rangoNivel(b) ? a : b);
export const siguienteNivel = (n: NivelOptica): NivelOptica | null => NIVELES[rangoNivel(n) + 1] ?? null;

export function corteDe(n: NivelOptica, cfg: ConfigNiveles): number {
  return n === 'VETRO' ? 0 : cfg.cortes[n];
}

export interface Sugerencia {
  variable: Variable;
  /** Puntos de la variable: de → a. */
  de: number;
  a: number;
  /** Puntos de puntaje que suma. */
  suma: number;
  puntajeNuevo: number;
  /** Nivel al que pasaría (si supera el actual). */
  pasaA: NivelOptica | null;
  accion: string;
  mensaje: string;
}

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

/**
 * Qué mover para subir: para cada variable, lo mínimo que hace falta para llegar a su próximo rango (en
 * recencia, un pedido ya da 5 puntos) y cuántos puntos de puntaje suma. Ordenadas de la que más suma a la
 * que menos (a igual suma, la de más peso). La primera es la sugerencia del panel.
 */
export function sugerencias(m: Metricas, cfg: ConfigNiveles, nivelActual: NivelOptica, puntosExtra = 0): Sugerencia[] {
  const actual = calcularPuntaje(m, cfg, puntosExtra);
  const out: Sugerencia[] = [];
  for (const v of VARIABLES) {
    const de = actual.puntos[v];
    if (de >= 5) continue;
    const cortes = cfg.rangos[v];
    let a = de + 1;
    let accion: string;
    switch (v) {
      case 'total': {
        const falta = Math.max(1, Math.ceil(cortes[de - 1]! - m.unidades));
        accion = `Si sumás ${plural(falta, 'unidad', 'unidades')} más en tus compras`;
        break;
      }
      case 'porCompra': {
        const objetivo = cortes[de - 1]!;
        const k = Math.max(1, Math.ceil(objetivo * (m.pedidosMayoristas + 1) - m.unidadesMayoristas));
        accion = `Si tu próxima compra es de ${plural(k, 'unidad', 'unidades')} o más`;
        break;
      }
      case 'frecuencia': {
        const falta = Math.max(1, cortes[de - 1]! - m.meses);
        accion = falta === 1 ? 'Si comprás en un mes más del año' : `Si comprás en ${falta} meses más del año`;
        break;
      }
      case 'recencia': {
        a = 5;
        accion = 'Si hacés un pedido en los próximos días';
        break;
      }
    }
    const suma = Math.round((a - de) * cfg.pesos[v] * 20);
    if (suma <= 0) continue;
    const puntajeNuevo = Math.min(100, actual.puntaje + suma);
    const nivelNuevo = nivelPorPuntaje(puntajeNuevo, cfg);
    const pasaA = rangoNivel(nivelNuevo) > rangoNivel(nivelActual) ? nivelNuevo : null;
    const mensaje = `${accion}, ${pasaA ? `pasás a ${NIVEL_INFO[pasaA].nombre}` : `sumás ${plural(suma, 'punto', 'puntos')}`}.`;
    out.push({ variable: v, de, a, suma, puntajeNuevo, pasaA, accion, mensaje });
  }
  out.sort((x, y) => y.suma - x.suma || cfg.pesos[y.variable] - cfg.pesos[x.variable]);
  return out;
}

// ------------------------------------------------------------------
// Reglas de nivel (función pura)
// ------------------------------------------------------------------

export interface Calidad {
  /** Pedidos web asignados a la óptica en 12 meses (entregados + vencidos sin aceptar). */
  pedidosWeb: number;
  aTiempoPct: number | null;
  calificaciones: number;
  satisfaccion: number | null;
}

export function calidadOk(c: Calidad, cfg: ConfigNiveles): { ok: boolean; motivo: string | null } {
  if (c.pedidosWeb === 0) return { ok: true, motivo: null };
  if (c.aTiempoPct !== null && c.aTiempoPct < cfg.minATiempoPct) {
    return { ok: false, motivo: `Para subir hace falta el ${cfg.minATiempoPct}% de los pedidos web a tiempo (tenés ${Math.round(c.aTiempoPct)}%)` };
  }
  if (c.calificaciones > 0 && c.satisfaccion !== null && c.satisfaccion < cfg.minSatisfaccion) {
    return {
      ok: false,
      motivo: `Para subir hace falta una satisfacción de ${cfg.minSatisfaccion.toLocaleString('es-AR')} o más (tenés ${c.satisfaccion.toLocaleString('es-AR', { maximumFractionDigits: 1 })})`,
    };
  }
  return { ok: true, motivo: null };
}

export function mesesEntre(desde: string, hasta: string): number {
  const [a, b] = desde.split('-').map(Number) as [number, number];
  const [c, d] = hasta.split('-').map(Number) as [number, number];
  return (c - a) * 12 + (d - b);
}

export function sumarMeses(mes: string, n: number): string {
  const [a, b] = mes.split('-').map(Number) as [number, number];
  const t = a * 12 + (b - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export interface Decision {
  nivel: NivelOptica;
  bajaPendienteDesde: string | null;
  motivo: string | null;
}

export function decidirNivel(input: {
  actual: NivelOptica;
  calculado: NivelOptica;
  mes: string;
  bajaPendienteDesde: string | null;
  diasSinActividad: number | null;
  calidad: Calidad;
  cfg: ConfigNiveles;
}): Decision {
  const { actual, calculado, mes, cfg } = input;
  if (input.diasSinActividad === null || input.diasSinActividad > cfg.diasInactividad) {
    return {
      nivel: 'VETRO',
      bajaPendienteDesde: null,
      motivo:
        actual === 'VETRO'
          ? null
          : input.diasSinActividad === null
            ? 'Sin actividad registrada'
            : `Más de ${cfg.diasInactividad} días sin actividad (${input.diasSinActividad})`,
    };
  }
  const r = rangoNivel(calculado) - rangoNivel(actual);
  if (r > 0) {
    const q = calidadOk(input.calidad, cfg);
    if (!q.ok) return { nivel: actual, bajaPendienteDesde: null, motivo: q.motivo };
    return { nivel: calculado, bajaPendienteDesde: null, motivo: `Subió a ${NIVEL_INFO[calculado].nombre} por puntaje` };
  }
  if (r < 0) {
    const desde = input.bajaPendienteDesde ?? mes;
    const transcurridos = mesesEntre(desde, mes);
    if (transcurridos >= cfg.mesesGracia) {
      return { nivel: calculado, bajaPendienteDesde: null, motivo: `Bajó a ${NIVEL_INFO[calculado].nombre} después de ${cfg.mesesGracia} meses de gracia` };
    }
    const hasta = sumarMeses(desde, cfg.mesesGracia);
    return {
      nivel: actual,
      bajaPendienteDesde: desde,
      motivo: `Puntaje de ${NIVEL_INFO[calculado].nombre}: mantiene ${NIVEL_INFO[actual].nombre} en gracia hasta el recálculo de ${hasta}`,
    };
  }
  return { nivel: actual, bajaPendienteDesde: null, motivo: null };
}

// ------------------------------------------------------------------
// Nivel vigente y beneficios
// ------------------------------------------------------------------

type OpticaNivel = Pick<Optica, 'nivel' | 'nivelManual' | 'nivelManualHasta' | 'beneficioProvisorio' | 'beneficioProvisorioHasta'>;

export function manualVigente(o: Pick<Optica, 'nivelManual' | 'nivelManualHasta'>, ahora = new Date()): boolean {
  return !!o.nivelManual && (!o.nivelManualHasta || o.nivelManualHasta > ahora);
}

/** Nivel que rige: el manual mientras no venza; si no, el del recálculo. */
export function nivelVigente(o: OpticaNivel, ahora = new Date()): NivelOptica {
  return manualVigente(o, ahora) ? o.nivelManual! : o.nivel;
}

/** Nivel cuyos beneficios se aplican (el vigente o el provisorio de bienvenida, el que sea mayor). */
export function nivelDeBeneficios(o: OpticaNivel, ahora = new Date()): NivelOptica {
  const n = nivelVigente(o, ahora);
  if (o.beneficioProvisorio && o.beneficioProvisorioHasta && o.beneficioProvisorioHasta > ahora) return maxNivel(n, o.beneficioProvisorio);
  return n;
}

export interface Condiciones extends Beneficios {
  nivel: NivelOptica;
  nivelBeneficios: NivelOptica;
  /** Prioridad en la asignación de pedidos web (mayor = antes). */
  prioridad: number;
  excepciones: { descuentoPct: boolean; limiteCredito: boolean; plazoPagoDias: boolean };
}

export function condicionesDe(
  o: OpticaNivel & { descuentoPct: Prisma.Decimal | number | null },
  cuenta: { limiteCredito: Prisma.Decimal | number | null; plazoPagoDias: number | null } | null,
  cfg: ConfigNiveles,
  ahora = new Date(),
): Condiciones {
  const nivel = nivelVigente(o, ahora);
  const nb = nivelDeBeneficios(o, ahora);
  const b = cfg.beneficios[nb];
  const desc = o.descuentoPct === null ? null : dec(o.descuentoPct as Prisma.Decimal);
  const lim = cuenta?.limiteCredito === null || cuenta?.limiteCredito === undefined ? null : dec(cuenta.limiteCredito as Prisma.Decimal);
  const plazo = cuenta?.plazoPagoDias ?? null;
  return {
    ...b,
    nivel,
    nivelBeneficios: nb,
    prioridad: rangoNivel(nb),
    descuentoPct: desc ?? b.descuentoPct,
    limiteCredito: lim ?? b.limiteCredito,
    plazoPagoDias: plazo ?? b.plazoPagoDias,
    excepciones: { descuentoPct: desc !== null, limiteCredito: lim !== null, plazoPagoDias: plazo !== null },
  };
}

export const opticaNivelSelect = {
  id: true,
  nivel: true,
  nivelManual: true,
  nivelManualHasta: true,
  beneficioProvisorio: true,
  beneficioProvisorioHasta: true,
  descuentoPct: true,
  cuentaCorriente: { select: { limiteCredito: true, plazoPagoDias: true } },
} as const satisfies Prisma.OpticaSelect;

/** Condiciones comerciales vigentes de una óptica (descuento, crédito, plazo y demás beneficios). */
export async function condicionesOptica(opticaId: string, db: Db = prisma, ahora = new Date()): Promise<Condiciones> {
  const [o, cfg] = await Promise.all([db.optica.findUnique({ where: { id: opticaId }, select: opticaNivelSelect }), getConfigNiveles(db)]);
  if (!o) return condicionesDe({ nivel: 'VETRO', nivelManual: null, nivelManualHasta: null, beneficioProvisorio: null, beneficioProvisorioHasta: null, descuentoPct: null }, null, cfg, ahora);
  return condicionesDe(o, o.cuentaCorriente, cfg, ahora);
}

/** Datos de nivel para una óptica recién creada: Vetro con beneficios de Cristallo por unos meses. */
export async function nivelInicial(db: Db = prisma, ahora = new Date()) {
  const cfg = await getConfigNiveles(db);
  const hasta = new Date(ahora);
  hasta.setMonth(hasta.getMonth() + cfg.mesesBeneficioNuevas);
  return {
    nivel: 'VETRO' as NivelOptica,
    nivelDesde: ahora,
    ...(cfg.mesesBeneficioNuevas > 0 ? { beneficioProvisorio: 'CRISTALLO' as NivelOptica, beneficioProvisorioHasta: hasta } : {}),
  };
}

/** Acceso anticipado: productos de colecciones que se lanzan dentro de `dias` días (o ya lanzadas). */
export function filtroLanzamiento(dias: number, ahora = new Date()): Prisma.ProductoWhereInput {
  const limite = new Date(ahora.getTime() + dias * DIA);
  return { OR: [{ coleccionId: null }, { coleccion: { vigenciaDesde: null } }, { coleccion: { vigenciaDesde: { lte: limite } } }] };
}

// ------------------------------------------------------------------
// Métricas (base de datos)
// ------------------------------------------------------------------

export function mesLocal(d: Date): string {
  const l = new Date(d.getTime() + TZ_MS);
  return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, '0')}`;
}

const pesoLinea = (cfg: ConfigNiveles, linea: Linea | null | undefined) => (linea ? cfg.ponderacionLinea[linea] : cfg.ponderacionLinea.SOL);
const ESTADOS_SALIDA = ['LISTO_PARA_RETIRO', 'DESPACHADO', 'ENTREGADO'] as const;

export async function metricasOptica(opticaId: string, cfg: ConfigNiveles, ahora = new Date(), db: Db = prisma): Promise<Metricas> {
  const desde = new Date(ahora.getTime() - 365 * DIA);
  const [mayoristas, web, ultMay, ultWeb, actMay] = await Promise.all([
    db.pedidoMayorista.findMany({
      where: {
        opticaId,
        estado: { in: [...ESTADOS_SALIDA] },
        OR: [{ despachadoEn: { gte: desde, lte: ahora } }, { despachadoEn: null, listoParaRetiroEn: { gte: desde, lte: ahora } }],
      },
      select: { unidades: true, items: { select: { cantidad: true, producto: { select: { linea: true } } } } },
    }),
    db.pedido.findMany({
      where: { opticaId, estado: 'ENTREGADO', entregadoEn: { gte: desde, lte: ahora } },
      select: { entregadoEn: true, items: { select: { cantidad: true, linea: true } } },
    }),
    db.pedidoMayorista.findFirst({ where: { opticaId, estado: { not: 'CANCELADO' }, createdAt: { lte: ahora } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    db.pedido.findFirst({ where: { opticaId, estado: 'ENTREGADO', entregadoEn: { lte: ahora } }, orderBy: { entregadoEn: 'desc' }, select: { entregadoEn: true } }),
    db.pedidoMayorista.findMany({ where: { opticaId, estado: { not: 'CANCELADO' }, createdAt: { gte: desde, lte: ahora } }, select: { createdAt: true } }),
  ]);
  let unidades = 0;
  for (const p of mayoristas) for (const i of p.items) unidades += i.cantidad * pesoLinea(cfg, i.producto?.linea);
  for (const p of web) for (const i of p.items) unidades += i.cantidad * pesoLinea(cfg, i.linea);
  const unidadesMayoristas = mayoristas.reduce((a, p) => a + p.unidades, 0);
  const meses = new Set<string>([...actMay.map((p) => mesLocal(p.createdAt)), ...web.map((p) => mesLocal(p.entregadoEn!))]);
  const fechas = [ultMay?.createdAt, ultWeb?.entregadoEn].filter((d): d is Date => !!d);
  const ultima = fechas.length ? new Date(Math.max(...fechas.map((d) => d.getTime()))) : null;
  return {
    unidades: Math.round(unidades * 100) / 100,
    porCompra: mayoristas.length ? Math.round((unidadesMayoristas / mayoristas.length) * 100) / 100 : 0,
    pedidosMayoristas: mayoristas.length,
    unidadesMayoristas,
    meses: Math.min(12, meses.size),
    diasSinActividad: ultima ? Math.max(0, Math.floor((ahora.getTime() - ultima.getTime()) / DIA)) : null,
    ultimaActividad: ultima ? ultima.toISOString() : null,
  };
}

const aTiempo = (p: { aceptadoEn: Date | null; aceptarAntesDe: Date | null }) => !p.aceptarAntesDe || !p.aceptadoEn || p.aceptadoEn <= p.aceptarAntesDe;

async function pedidosWebParaCalidad(opticaId: string, desde: Date, ahora: Date, db: Db) {
  const [entregados, vencidos] = await Promise.all([
    db.pedido.findMany({
      where: { opticaId, estado: 'ENTREGADO', entregadoEn: { gte: desde, lte: ahora } },
      select: { entregadoEn: true, aceptadoEn: true, aceptarAntesDe: true },
    }),
    db.pedidoEvento.findMany({
      where: { opticaId, tipo: 'RECHAZO', createdAt: { gte: desde, lte: ahora }, datos: { path: ['vencido'], equals: true } },
      select: { createdAt: true },
    }),
  ]);
  return { entregados, vencidos };
}

export async function calidadOptica(opticaId: string, ahora = new Date(), db: Db = prisma): Promise<Calidad> {
  const desde = new Date(ahora.getTime() - 365 * DIA);
  const [{ entregados, vencidos }, cal] = await Promise.all([
    pedidosWebParaCalidad(opticaId, desde, ahora, db),
    db.calificacionPedido.aggregate({ where: { opticaId, createdAt: { gte: desde, lte: ahora } }, _avg: { puntaje: true }, _count: { _all: true } }),
  ]);
  const pedidosWeb = entregados.length + vencidos.length;
  const ok = entregados.filter(aTiempo).length;
  return {
    pedidosWeb,
    aTiempoPct: pedidosWeb ? Math.round((ok / pedidosWeb) * 1000) / 10 : null,
    calificaciones: cal._count._all,
    satisfaccion: cal._avg.puntaje === null ? null : Math.round(cal._avg.puntaje * 100) / 100,
  };
}

// ------------------------------------------------------------------
// Logros
// ------------------------------------------------------------------

async function cumpleLogro(logro: TipoLogro, optica: Pick<Optica, 'id' | 'muestrarioEn' | 'fotosVitrina'>, ahora: Date, db: Db): Promise<boolean> {
  const opticaId = optica.id;
  switch (logro) {
    case 'PRIMER_FOCO':
      return (await db.pedidoMayorista.count({ where: { opticaId, estado: { in: [...ESTADOS_SALIDA] } } })) > 0;
    case 'MANO_FIRME':
      return (await db.pedido.count({ where: { opticaId, estado: 'ENTREGADO', solicitudes: { none: {} } } })) >= 50;
    case 'MULTIFOCAL_MAESTRO': {
      const agg = await db.pedidoItem.aggregate({
        where: { linea: 'MULTIFOCAL', pedido: { opticaId, estado: 'ENTREGADO', solicitudes: { none: {} } } },
        _sum: { cantidad: true },
      });
      return (agg._sum.cantidad ?? 0) >= 20;
    }
    case 'RELOJITO': {
      const desde = new Date(ahora.getTime() - 400 * DIA);
      const { entregados, vencidos } = await pedidosWebParaCalidad(opticaId, desde, ahora, db);
      const porMes = new Map<string, { total: number; ok: number }>();
      for (const p of entregados) {
        const m = mesLocal(p.entregadoEn!);
        const x = porMes.get(m) ?? { total: 0, ok: 0 };
        x.total++;
        if (aTiempo(p)) x.ok++;
        porMes.set(m, x);
      }
      for (const v of vencidos) {
        const m = mesLocal(v.createdAt);
        const x = porMes.get(m) ?? { total: 0, ok: 0 };
        x.total++;
        porMes.set(m, x);
      }
      const perfecto = (m: string) => {
        const x = porMes.get(m);
        return !!x && x.total > 0 && x.ok === x.total;
      };
      const actual = mesLocal(ahora);
      for (let i = 0; i <= 12; i++) {
        const m = sumarMeses(actual, -i);
        if (perfecto(m) && perfecto(sumarMeses(m, -1)) && perfecto(sumarMeses(m, -2))) return true;
      }
      return false;
    }
    case 'VITRINA_VEDERE':
      return !!optica.muestrarioEn && optica.fotosVitrina.length >= FOTOS_VITRINA_MIN;
    case 'EMBAJADORA':
      return (await db.optica.count({ where: { referidaPorId: opticaId } })) > 0;
  }
}

function destinatario(o: { email: string | null; usuarios?: Array<{ email: string }> }) {
  return o.email ?? o.usuarios?.[0]?.email ?? null;
}

const opticaEmailSelect = {
  id: true,
  nombre: true,
  email: true,
  usuarios: { where: { activo: true }, orderBy: [{ opticaDueno: 'desc' as const }, { createdAt: 'asc' as const }], take: 1, select: { email: true } },
} satisfies Prisma.OpticaSelect;

/** Evalúa los logros pendientes; crea los nuevos y avisa por email. Devuelve los obtenidos ahora. */
export async function evaluarLogros(env: Env, opticaId: string, opts: { ahora?: Date; db?: Db; cfg?: ConfigNiveles } = {}): Promise<TipoLogro[]> {
  const db = opts.db ?? prisma;
  const ahora = opts.ahora ?? new Date();
  const cfg = opts.cfg ?? (await getConfigNiveles(db));
  const optica = await db.optica.findUnique({
    where: { id: opticaId },
    select: { ...opticaEmailSelect, muestrarioEn: true, fotosVitrina: true, logros: { select: { logro: true } } },
  });
  if (!optica) return [];
  const tiene = new Set(optica.logros.map((l) => l.logro));
  const nuevos: TipoLogro[] = [];
  for (const logro of LOGROS) {
    if (tiene.has(logro)) continue;
    if (!(await cumpleLogro(logro, optica, ahora, db))) continue;
    const creado = await db.logroOptica.createMany({ data: [{ opticaId, logro, puntos: cfg.logros[logro], obtenidoEn: ahora }], skipDuplicates: true });
    if (creado.count) nuevos.push(logro);
  }
  const para = destinatario(optica);
  if (para) {
    const web = env.WEB_URL.replace(/\/$/, '');
    for (const logro of nuevos) {
      const info = LOGRO_INFO[logro];
      const titulo = `¡Lograste "${info.nombre}"!`;
      await enviarEmail(
        env,
        {
          para,
          asunto: `${titulo} · Vedere`,
          html: layoutEmail(env, {
            titulo,
            cuerpo: `<p>${info.descripcion}</p><p>Suma ${plural(cfg.logros[logro], 'punto extra', 'puntos extra')} a tu puntaje durante un año (hasta ${cfg.maxPuntosLogrosAnio} por año).</p>`,
            cta: { label: 'Ver mi nivel', href: `${web}/optica/nivel` },
          }),
        },
        { tipo: 'NIVEL_LOGRO' },
        db,
      );
    }
  }
  return nuevos;
}

/** Puntos extra de los logros obtenidos en el último año, con tope anual. */
export async function puntosExtraLogros(opticaId: string, cfg: ConfigNiveles, ahora = new Date(), db: Db = prisma): Promise<number> {
  const logros = await db.logroOptica.findMany({ where: { opticaId, obtenidoEn: { gt: new Date(ahora.getTime() - 365 * DIA) } }, select: { puntos: true } });
  return Math.min(cfg.maxPuntosLogrosAnio, logros.reduce((a, l) => a + l.puntos, 0));
}

// ------------------------------------------------------------------
// Recálculo
// ------------------------------------------------------------------

export interface ResultadoRecalculo {
  opticaId: string;
  nombre: string;
  puntaje: number;
  nivelCalculado: NivelOptica;
  nivelAnterior: NivelOptica;
  nivel: NivelOptica;
  cambio: boolean;
  motivo: string | null;
  logrosNuevos: TipoLogro[];
}

export async function recalcularNivel(env: Env, opticaId: string, opts: { ahora?: Date } = {}): Promise<ResultadoRecalculo | null> {
  const ahora = opts.ahora ?? new Date();
  const cfg = await getConfigNiveles();
  const optica = await prisma.optica.findUnique({ where: { id: opticaId }, select: { ...opticaEmailSelect, ...opticaNivelSelect, bajaPendienteDesde: true } });
  if (!optica) return null;
  const logrosNuevos = await evaluarLogros(env, opticaId, { ahora, cfg });
  const [metricas, calidad, extra] = await Promise.all([
    metricasOptica(opticaId, cfg, ahora),
    calidadOptica(opticaId, ahora),
    puntosExtraLogros(opticaId, cfg, ahora),
  ]);
  const p = calcularPuntaje(metricas, cfg, extra);
  const nivelCalculado = nivelPorPuntaje(p.puntaje, cfg);
  const mes = mesLocal(ahora);
  const d = decidirNivel({
    actual: optica.nivel,
    calculado: nivelCalculado,
    mes,
    bajaPendienteDesde: optica.bajaPendienteDesde,
    diasSinActividad: metricas.diasSinActividad,
    calidad,
    cfg,
  });
  const vigenteAntes = nivelVigente(optica, ahora);
  const manualVencido = !!optica.nivelManual && !manualVigente(optica, ahora);
  const cambioAuto = d.nivel !== optica.nivel;
  await prisma.$transaction([
    prisma.optica.update({
      where: { id: opticaId },
      data: {
        nivel: d.nivel,
        puntaje: p.puntaje,
        nivelCalculadoEn: ahora,
        bajaPendienteDesde: d.bajaPendienteDesde,
        ...(cambioAuto ? { nivelDesde: ahora } : {}),
        ...(manualVencido ? { nivelManual: null, nivelManualHasta: null, nivelManualMotivo: null, nivelManualPorId: null } : {}),
      },
    }),
    prisma.historialNivel.upsert({
      where: { opticaId_mes: { opticaId, mes } },
      create: {
        opticaId,
        mes,
        puntaje: p.puntaje,
        puntosExtra: extra,
        nivelCalculado,
        nivel: d.nivel,
        nivelAnterior: optica.nivel,
        motivo: d.motivo,
        detalle: { metricas, puntos: p.puntos, base: p.base, calidad } as unknown as Prisma.InputJsonValue,
      },
      update: {
        puntaje: p.puntaje,
        puntosExtra: extra,
        nivelCalculado,
        nivel: d.nivel,
        motivo: d.motivo,
        detalle: { metricas, puntos: p.puntos, base: p.base, calidad } as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);
  const despues = { ...optica, nivel: d.nivel, ...(manualVencido ? { nivelManual: null, nivelManualHasta: null } : {}) };
  const vigenteDespues = nivelVigente(despues, ahora);
  if (vigenteDespues !== vigenteAntes) await emailCambioNivel(env, optica, vigenteAntes, vigenteDespues, cfg, d.motivo);
  return {
    opticaId,
    nombre: optica.nombre,
    puntaje: p.puntaje,
    nivelCalculado,
    nivelAnterior: optica.nivel,
    nivel: d.nivel,
    cambio: vigenteDespues !== vigenteAntes,
    motivo: d.motivo,
    logrosNuevos,
  };
}

export async function emailCambioNivel(
  env: Env,
  optica: { email: string | null; usuarios?: Array<{ email: string }> },
  antes: NivelOptica,
  despues: NivelOptica,
  cfg: ConfigNiveles,
  motivo?: string | null,
) {
  const para = destinatario(optica);
  if (!para) return;
  const sube = rangoNivel(despues) > rangoNivel(antes);
  const b = cfg.beneficios[despues];
  const titulo = sube ? `¡Subiste a ${NIVEL_INFO[despues].nombre}!` : `Tu nivel ahora es ${NIVEL_INFO[despues].nombre}`;
  const web = env.WEB_URL.replace(/\/$/, '');
  const ars = (n: number) => `$${n.toLocaleString('es-AR')}`;
  await enviarEmail(
    env,
    {
      para,
      asunto: `${titulo} · Vedere`,
      html: layoutEmail(env, {
        titulo,
        cuerpo:
          `<p>Pasaste de ${NIVEL_INFO[antes].nombre} a <strong>${NIVEL_INFO[despues].nombre}</strong>.${motivo ? ` ${motivo}.` : ''}</p>` +
          `<p>Tus condiciones: ${b.descuentoPct}% de descuento sobre el precio mayorista, crédito de ${ars(b.limiteCredito)} a ${b.plazoPagoDias} días.</p>`,
        cta: { label: 'Ver mi nivel', href: `${web}/optica/nivel` },
      }),
    },
    { tipo: 'NIVEL_CAMBIO' },
  );
}

/** Recalcula todas las ópticas activas. Devuelve los resultados. */
export async function recalcularTodas(env: Env, ahora = new Date()): Promise<ResultadoRecalculo[]> {
  const opticas = await prisma.optica.findMany({ where: { activa: true }, select: { id: true }, orderBy: { nombre: 'asc' } });
  const out: ResultadoRecalculo[] = [];
  for (const o of opticas) {
    const r = await recalcularNivel(env, o.id, { ahora });
    if (r) out.push(r);
  }
  return out;
}

/** Nivel manual (con motivo y vencimiento) o null para quitarlo. */
export async function asignarNivelManual(
  env: Env,
  opticaId: string,
  input: { nivel: NivelOptica; motivo: string; hasta: Date | null } | null,
  actor: { id: string | null },
  ahora = new Date(),
) {
  const cfg = await getConfigNiveles();
  const optica = await prisma.optica.findUnique({ where: { id: opticaId }, select: { ...opticaEmailSelect, ...opticaNivelSelect } });
  if (!optica) return null;
  const antes = nivelVigente(optica, ahora);
  const data = input
    ? { nivelManual: input.nivel, nivelManualMotivo: input.motivo, nivelManualHasta: input.hasta, nivelManualPorId: actor.id }
    : { nivelManual: null, nivelManualMotivo: null, nivelManualHasta: null, nivelManualPorId: null };
  const o = await prisma.optica.update({ where: { id: opticaId }, data, select: opticaNivelSelect });
  const despues = nivelVigente(o, ahora);
  if (despues !== antes) await emailCambioNivel(env, optica, antes, despues, cfg, input ? input.motivo : 'Se quitó el nivel manual');
  return o;
}

// ------------------------------------------------------------------
// Panel (óptica y admin)
// ------------------------------------------------------------------

export async function panelNivel(opticaId: string, ahora = new Date()) {
  const cfg = await getConfigNiveles();
  const optica = await prisma.optica.findUnique({
    where: { id: opticaId },
    select: {
      ...opticaNivelSelect,
      nombre: true,
      puntaje: true,
      nivelDesde: true,
      nivelCalculadoEn: true,
      bajaPendienteDesde: true,
      nivelManualMotivo: true,
      muestrarioEn: true,
      fotosVitrina: true,
      logros: { select: { logro: true, puntos: true, obtenidoEn: true } },
      historialNiveles: { orderBy: { mes: 'desc' }, take: 12, select: { mes: true, puntaje: true, nivel: true, nivelCalculado: true, motivo: true } },
    },
  });
  if (!optica) return null;
  const [metricas, calidad, extra] = await Promise.all([metricasOptica(opticaId, cfg, ahora), calidadOptica(opticaId, ahora), puntosExtraLogros(opticaId, cfg, ahora)]);
  const p = calcularPuntaje(metricas, cfg, extra);
  const cond = condicionesDe(optica, optica.cuentaCorriente, cfg, ahora);
  const nivel = cond.nivel;
  const sig = siguienteNivel(nivel);
  const sugs = sugerencias(metricas, cfg, nivel, extra);
  const desde = corteDe(nivel, cfg);
  const hasta = sig ? corteDe(sig, cfg) : 100;
  const progreso = sig ? Math.max(0, Math.min(100, Math.round(((p.puntaje - desde) / (hasta - desde)) * 100))) : 100;
  const logros = new Map(optica.logros.map((l) => [l.logro, l]));
  return {
    optica: { id: optica.id, nombre: optica.nombre },
    nivel,
    nivelInfo: NIVEL_INFO[nivel],
    nivelAutomatico: optica.nivel,
    nivelDesde: optica.nivelDesde,
    nivelCalculadoEn: optica.nivelCalculadoEn,
    puntajeOficial: optica.puntaje,
    manual: manualVigente(optica, ahora) ? { nivel: optica.nivelManual!, motivo: optica.nivelManualMotivo, hasta: optica.nivelManualHasta } : null,
    provisorio:
      optica.beneficioProvisorio && optica.beneficioProvisorioHasta && optica.beneficioProvisorioHasta > ahora
        ? { nivel: optica.beneficioProvisorio, hasta: optica.beneficioProvisorioHasta }
        : null,
    gracia: optica.bajaPendienteDesde ? { desde: optica.bajaPendienteDesde, hasta: sumarMeses(optica.bajaPendienteDesde, cfg.mesesGracia) } : null,
    puntaje: p.puntaje,
    base: p.base,
    puntosExtra: extra,
    nivelPorPuntaje: nivelPorPuntaje(p.puntaje, cfg),
    progreso: { desde, hasta, pct: progreso, siguiente: sig, faltan: sig ? Math.max(0, hasta - p.puntaje) : 0 },
    variables: VARIABLES.map((v) => ({
      variable: v,
      ...VARIABLE_INFO[v],
      valor: valorVariable(v, metricas),
      puntos: p.puntos[v],
      peso: cfg.pesos[v],
      aporte: Math.round(p.puntos[v] * cfg.pesos[v] * 20 * 10) / 10,
    })),
    metricas,
    calidad,
    calidadParaSubir: calidadOk(calidad, cfg),
    sugerencia: sugs[0] ?? null,
    sugerencias: sugs,
    beneficios: { actual: { nivel: cond.nivelBeneficios, ...cfg.beneficios[cond.nivelBeneficios] }, siguiente: sig ? { nivel: sig, ...cfg.beneficios[sig] } : null },
    condiciones: cond,
    logros: LOGROS.map((l) => ({
      logro: l,
      ...LOGRO_INFO[l],
      puntos: cfg.logros[l],
      obtenido: logros.has(l),
      obtenidoEn: logros.get(l)?.obtenidoEn ?? null,
    })),
    vitrina: { muestrario: !!optica.muestrarioEn, fotos: optica.fotosVitrina, minimo: FOTOS_VITRINA_MIN },
    historial: optica.historialNiveles,
    cortes: cfg.cortes,
    reglas: {
      minATiempoPct: cfg.minATiempoPct,
      minSatisfaccion: cfg.minSatisfaccion,
      mesesGracia: cfg.mesesGracia,
      diasInactividad: cfg.diasInactividad,
      maxPuntosLogrosAnio: cfg.maxPuntosLogrosAnio,
    },
  };
}
