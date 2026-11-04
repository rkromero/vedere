// B2B 4: niveles y logros de las ópticas socias (tipos compartidos por /optica/nivel y /admin/niveles).

export type NivelOptica = 'VETRO' | 'CRISTALLO' | 'PRISMA' | 'ZAFIRO';
export const NIVELES: NivelOptica[] = ['VETRO', 'CRISTALLO', 'PRISMA', 'ZAFIRO'];

export const NIVEL_INFO: Record<NivelOptica, { nombre: string; color: string; texto: string }> = {
  VETRO: { nombre: 'Vetro', color: '#F2F2F0', texto: '#0A0A0A' },
  CRISTALLO: { nombre: 'Cristallo', color: '#7FD1C1', texto: '#0A0A0A' },
  PRISMA: { nombre: 'Prisma', color: '#3A5BD9', texto: '#FFFFFF' },
  ZAFIRO: { nombre: 'Zafiro', color: '#0A0A0A', texto: '#FFFFFF' },
};

export type Variable = 'total' | 'porCompra' | 'frecuencia' | 'recencia';
export type TipoLogro = 'PRIMER_FOCO' | 'MANO_FIRME' | 'MULTIFOCAL_MAESTRO' | 'RELOJITO' | 'VITRINA_VEDERE' | 'EMBAJADORA';

export interface Beneficios {
  descuentoPct: number;
  limiteCredito: number;
  plazoPagoDias: number;
  radioExclusividadKm: number;
  accesoAnticipadoDias: number;
}

export interface Sugerencia {
  variable: Variable;
  de: number;
  a: number;
  suma: number;
  puntajeNuevo: number;
  pasaA: NivelOptica | null;
  mensaje: string;
}

export interface PanelNivel {
  optica: { id: string; nombre: string };
  nivel: NivelOptica;
  nivelAutomatico: NivelOptica;
  nivelDesde: string;
  nivelCalculadoEn: string | null;
  puntajeOficial: number | null;
  manual: { nivel: NivelOptica; motivo: string | null; hasta: string | null } | null;
  provisorio: { nivel: NivelOptica; hasta: string } | null;
  gracia: { desde: string; hasta: string } | null;
  puntaje: number;
  base: number;
  puntosExtra: number;
  nivelPorPuntaje: NivelOptica;
  progreso: { desde: number; hasta: number; pct: number; siguiente: NivelOptica | null; faltan: number };
  variables: Array<{ variable: Variable; nombre: string; unidad: string; valor: number | null; puntos: number; peso: number; aporte: number }>;
  metricas: { unidades: number; porCompra: number; pedidosMayoristas: number; meses: number; diasSinActividad: number | null; ultimaActividad: string | null };
  calidad: { pedidosWeb: number; aTiempoPct: number | null; calificaciones: number; satisfaccion: number | null };
  calidadParaSubir: { ok: boolean; motivo: string | null };
  sugerencia: Sugerencia | null;
  sugerencias: Sugerencia[];
  beneficios: { actual: Beneficios & { nivel: NivelOptica }; siguiente: (Beneficios & { nivel: NivelOptica }) | null };
  condiciones: Beneficios & { nivel: NivelOptica; nivelBeneficios: NivelOptica; excepciones: { descuentoPct: boolean; limiteCredito: boolean; plazoPagoDias: boolean } };
  logros: Array<{ logro: TipoLogro; nombre: string; descripcion: string; puntos: number; obtenido: boolean; obtenidoEn: string | null }>;
  vitrina: { muestrario: boolean; fotos: string[]; minimo: number };
  historial: Array<{ mes: string; puntaje: number; nivel: NivelOptica; nivelCalculado: NivelOptica; motivo: string | null }>;
  cortes: { CRISTALLO: number; PRISMA: number; ZAFIRO: number };
  reglas: { minATiempoPct: number; minSatisfaccion: number; mesesGracia: number; diasInactividad: number; maxPuntosLogrosAnio: number };
}

export interface ConfigNiveles {
  cortes: { CRISTALLO: number; PRISMA: number; ZAFIRO: number };
  pesos: Record<Variable, number>;
  rangos: Record<Variable, number[]>;
  ponderacionLinea: { SOL: number; RECETADO: number; MULTIFOCAL: number; ACCESORIO: number };
  beneficios: Record<NivelOptica, Beneficios>;
  logros: Record<TipoLogro, number>;
  maxPuntosLogrosAnio: number;
  mesesGracia: number;
  diasInactividad: number;
  minATiempoPct: number;
  minSatisfaccion: number;
  mesesBeneficioNuevas: number;
}

export interface FilaReporteNiveles {
  id: string;
  nombre: string;
  localidad: string;
  nivel: NivelOptica;
  nivelAutomatico: NivelOptica;
  nivelBeneficios: NivelOptica;
  puntaje: number | null;
  tendencia: number | null;
  nivelDesde: string;
  nivelCalculadoEn: string | null;
  manual: { nivel: NivelOptica; hasta: string | null; motivo: string | null } | null;
  provisorio: { nivel: NivelOptica; hasta: string } | null;
  enGracia: boolean;
  logros: number;
  descuentoPct: number;
  limiteCredito: number;
  plazoPagoDias: number;
}

export interface ReporteNiveles {
  mes: string;
  porNivel: Record<NivelOptica, number>;
  evolucion: Array<Record<NivelOptica, number> & { mes: string; total: number }>;
  opticas: FilaReporteNiveles[];
}

export const LOGRO_ICONO: Record<TipoLogro, string> = {
  PRIMER_FOCO: '◎',
  MANO_FIRME: '✋',
  MULTIFOCAL_MAESTRO: '◐',
  RELOJITO: '⏱',
  VITRINA_VEDERE: '▣',
  EMBAJADORA: '✦',
};

export const VARIABLE_LABEL: Record<Variable, string> = {
  total: 'Unidades en 12 meses',
  porCompra: 'Unidades por compra',
  frecuencia: 'Meses con actividad',
  recencia: 'Última actividad',
};

export function valorVariable(v: Variable, valor: number | null): string {
  if (valor === null) return 'Sin actividad';
  switch (v) {
    case 'total':
      return `${valor.toLocaleString('es-AR', { maximumFractionDigits: 1 })} u.`;
    case 'porCompra':
      return `${valor.toLocaleString('es-AR', { maximumFractionDigits: 1 })} u. por pedido`;
    case 'frecuencia':
      return `${valor} de 12 meses`;
    case 'recencia':
      return valor === 0 ? 'Hoy' : valor === 1 ? 'Hace 1 día' : `Hace ${valor} días`;
  }
}

export function formatMesCorto(mes: string): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const nombres = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${nombres[m - 1]} ${String(a).slice(2)}`;
}
