// Tipos del backoffice para el prompt 6 (reportes, plantillas de email, páginas legales, redirecciones,
// arrepentimientos, newsletter y configuración fiscal). Reflejan los contratos de docs/PLAN-PROMPT6.md.

// ---------- Reportes ----------
export interface ReporteTotales {
  ventas: number;
  pedidos: number;
  ticketPromedio: number;
  conversion: { pedidosPagados: number; carritos: number; pct: number };
}
export interface ReporteDia {
  fecha: string;
  ventas: number;
  pedidos: number;
}
export interface ReporteAgrupado {
  clave: string;
  nombre: string;
  pedidos?: number;
  unidades?: number;
  ventas: number;
}
export interface ReporteEstado {
  estado: string;
  cantidad: number;
  ventas: number;
}
export interface ReporteMasVendido {
  productoId: string;
  nombre: string;
  slug: string;
  unidades: number;
  ventas: number;
}
export interface Reporte {
  periodo: { desde: string; hasta: string };
  totales: ReporteTotales;
  porDia: ReporteDia[];
  hoy: { ventas: number; pedidos: number };
  semana: { ventas: number; pedidos: number };
  mes: { ventas: number; pedidos: number };
  porEstado: ReporteEstado[];
  porLinea: ReporteAgrupado[];
  porOptica: ReporteAgrupado[];
  porColeccion: ReporteAgrupado[];
  porCreador: ReporteAgrupado[];
  masVendidos: ReporteMasVendido[];
}

// ---------- Plantillas de email ----------
export interface PlantillaEmail {
  tipo: string;
  nombre: string;
  descripcion: string | null;
  variables: string[];
  asunto: string;
  titulo: string;
  cuerpo: string;
  ctaLabel: string | null;
  activa: boolean;
  personalizada: boolean;
  updatedAt?: string | null;
}

// ---------- Páginas legales ----------
export interface PaginaLegal {
  id?: string;
  slug: string;
  titulo: string;
  intro: string | null;
  contenido: string;
  publicada: boolean;
  updatedAt?: string | null;
}

// ---------- Redirecciones ----------
export interface Redireccion {
  id: string;
  origen: string;
  destino: string;
  permanente: boolean;
  activa: boolean;
  hits: number;
  createdAt: string;
  updatedAt: string;
}

// ---------- Arrepentimientos ----------
export type EstadoArrepentimiento = 'RECIBIDO' | 'EN_PROCESO' | 'RESUELTO' | 'RECHAZADO';
export const ESTADOS_ARREPENTIMIENTO: EstadoArrepentimiento[] = ['RECIBIDO', 'EN_PROCESO', 'RESUELTO', 'RECHAZADO'];
export const ESTADO_ARREPENTIMIENTO_LABEL: Record<EstadoArrepentimiento, string> = {
  RECIBIDO: 'Recibido',
  EN_PROCESO: 'En proceso',
  RESUELTO: 'Resuelto',
  RECHAZADO: 'Rechazado',
};
export interface Arrepentimiento {
  id: string;
  numeroTramite: string;
  nombre: string;
  email: string;
  dni: string | null;
  telefono: string | null;
  pedidoNumero: string | null;
  pedidoId: string | null;
  motivo: string | null;
  estado: EstadoArrepentimiento;
  respuesta: string | null;
  resueltoEn: string | null;
  resueltoPorId?: string | null;
  createdAt: string;
  updatedAt?: string;
}
export type ResumenArrepentimientos = Record<EstadoArrepentimiento, number>;

// ---------- Newsletter ----------
export interface SuscriptorNewsletter {
  id: string;
  email: string;
  nombre?: string | null;
  origen: string | null;
  bajaEn?: string | null;
  createdAt: string;
}

// ---------- Configuración fiscal y programas ----------
export interface TiendaConfigFiscal {
  razonSocial: string | null;
  cuit: string | null;
  domicilioFiscal: string | null;
  condicionIva: string | null;
  ingresosBrutos: string | null;
  inicioActividades: string | null;
  emailContacto: string | null;
  rivedereMeses: number;
  rivedereDescuentoPct: number;
  referidoDescuentoPct: number;
  carritoAbandonadoHabilitado: boolean;
}

/** Fecha local (Argentina) en formato YYYY-MM-DD, con desplazamiento opcional en días. */
export function fechaISO(offsetDias = 0): string {
  const d = new Date(Date.now() + offsetDias * 86_400_000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
