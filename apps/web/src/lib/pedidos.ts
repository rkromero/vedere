// Tipos y etiquetas de pedidos, ópticas y solicitudes (prompt 5). Módulo plano: sirve en server y client.
import type { BadgeTone, Linea, Rol } from '@/lib/format';
import type { EstadoPago, MetodoPago, Modalidad, ModoReceta } from '@/lib/tienda/checkout';

export type EstadoPedido =
  | 'PENDIENTE_PAGO'
  | 'PAGADO'
  | 'ASIGNADO'
  | 'ACEPTADO'
  | 'EN_ARMADO'
  | 'LISTO'
  | 'ENVIADO'
  | 'ENTREGADO'
  | 'CANCELADO'
  | 'DEVUELTO';
export type CanalPedido = 'WEB' | 'WHATSAPP' | 'OPTICA' | 'ADMIN';
export type TipoEvento = 'ESTADO' | 'ASIGNACION' | 'RECHAZO' | 'NOTA' | 'EMAIL' | 'PAGO' | 'REEMBOLSO' | 'SOLICITUD';
export type TipoSolicitud = 'CAMBIO' | 'DEVOLUCION';
export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
export type ResolucionSolicitud = 'NUEVO_PEDIDO' | 'REINTEGRO';
export type TipoTurno = 'MEDICION' | 'AJUSTE' | 'RETIRO' | 'OTRO';
export type EstadoTurno = 'PROGRAMADO' | 'REALIZADO' | 'CANCELADO';

export const ESTADOS_PEDIDO: EstadoPedido[] = [
  'PENDIENTE_PAGO',
  'PAGADO',
  'ASIGNADO',
  'ACEPTADO',
  'EN_ARMADO',
  'LISTO',
  'ENVIADO',
  'ENTREGADO',
  'CANCELADO',
  'DEVUELTO',
];

export const ESTADO_PEDIDO_LABEL: Record<EstadoPedido, string> = {
  PENDIENTE_PAGO: 'Pendiente de pago',
  PAGADO: 'Pagado · sin asignar',
  ASIGNADO: 'Asignado a óptica',
  ACEPTADO: 'Aceptado por la óptica',
  EN_ARMADO: 'En armado',
  LISTO: 'Listo para retirar',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado y ajustado',
  CANCELADO: 'Cancelado',
  DEVUELTO: 'Devuelto',
};

export function estadoPedidoTone(estado: string): BadgeTone {
  switch (estado) {
    case 'ENTREGADO':
      return 'ok';
    case 'CANCELADO':
    case 'DEVUELTO':
      return 'danger';
    case 'PENDIENTE_PAGO':
    case 'PAGADO':
      return 'warn';
    case 'ASIGNADO':
    case 'ACEPTADO':
    case 'EN_ARMADO':
    case 'LISTO':
    case 'ENVIADO':
      return 'info';
    default:
      return 'neutral';
  }
}

export function estadoPagoTone(estado: string): BadgeTone {
  if (estado === 'APROBADO') return 'ok';
  if (estado === 'RECHAZADO') return 'danger';
  if (estado === 'REEMBOLSADO') return 'neutral';
  return 'warn';
}

export const CANAL_LABEL: Record<CanalPedido, string> = {
  WEB: 'Web',
  WHATSAPP: 'WhatsApp',
  OPTICA: 'Óptica',
  ADMIN: 'Backoffice',
};

export const TIPO_EVENTO_LABEL: Record<TipoEvento, string> = {
  ESTADO: 'Cambio de estado',
  ASIGNACION: 'Asignación',
  RECHAZO: 'Rechazo de la óptica',
  NOTA: 'Nota interna',
  EMAIL: 'Email',
  PAGO: 'Pago',
  REEMBOLSO: 'Reembolso',
  SOLICITUD: 'Cambio / devolución',
};

export const TIPO_SOLICITUD_LABEL: Record<TipoSolicitud, string> = {
  CAMBIO: 'Cambio',
  DEVOLUCION: 'Devolución',
};
export const ESTADO_SOLICITUD_LABEL: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};
export const RESOLUCION_LABEL: Record<ResolucionSolicitud, string> = {
  NUEVO_PEDIDO: 'Nuevo pedido sin cargo',
  REINTEGRO: 'Reintegro del dinero',
};
export const TIPO_TURNO_LABEL: Record<TipoTurno, string> = {
  MEDICION: 'Medición',
  AJUSTE: 'Ajuste',
  RETIRO: 'Retiro',
  OTRO: 'Otro',
};
export const ESTADO_TURNO_LABEL: Record<EstadoTurno, string> = {
  PROGRAMADO: 'Programado',
  REALIZADO: 'Realizado',
  CANCELADO: 'Cancelado',
};

// ---------- Respuestas de la API ----------

export interface PedidoItem {
  id: string;
  varianteId: string;
  productoId: string;
  nombre: string;
  sku: string;
  color: string | null;
  imagen: string | null;
  linea: Linea;
  precioUnitario: number;
  precioLista: number | null;
  cantidad: number;
  descuento: number;
  total: number;
  conReceta: boolean;
}

export interface Receta {
  id: string;
  modo: ModoReceta;
  odEsfera: number | null;
  odCilindro: number | null;
  odEje: number | null;
  oiEsfera: number | null;
  oiCilindro: number | null;
  oiEje: number | null;
  adicion: number | null;
  dp: number | null;
  archivoUrl: string | null;
  archivoNombre: string | null;
  notas: string | null;
}

export interface PedidoEvento {
  id: string;
  tipo: TipoEvento;
  estadoAnterior: EstadoPedido | null;
  estadoNuevo: EstadoPedido | null;
  optica: { id: string; nombre: string } | null;
  actor: { id: string | null; nombre: string | null; rol: Rol | null };
  nota: string | null;
  datos: Record<string, unknown> | null;
  createdAt: string;
}

export interface Solicitud {
  id: string;
  pedidoId: string;
  tipo: TipoSolicitud;
  motivo: string;
  detalle: string | null;
  estado: EstadoSolicitud;
  resolucion: ResolucionSolicitud | null;
  nuevoPedidoId: string | null;
  respuesta: string | null;
  resueltoPorId: string | null;
  resueltoEn: string | null;
  createdAt: string;
}

export interface Turno {
  id: string;
  opticaId: string;
  optica?: { id: string; nombre: string } | null;
  pedidoId: string | null;
  pedido?: { id: string; numero: string; estado: EstadoPedido } | null;
  tipo: TipoTurno;
  estado: EstadoTurno;
  fecha: string;
  duracionMin: number;
  clienteNombre: string;
  clienteTelefono: string | null;
  notas: string | null;
  createdAt: string;
}

export interface Reembolso {
  id: string;
  proveedor: string;
  externoId: string | null;
  monto: number;
  motivo: string;
  estado: string;
  creadoPorId: string | null;
  createdAt: string;
}

export interface EmailEnviado {
  id: string;
  tipo: string;
  para: string;
  asunto: string;
  estado: 'ENVIADO' | 'SIMULADO' | 'ERROR';
  error: string | null;
  createdAt: string;
}

export interface PedidoOpticaRef {
  id: string;
  nombre: string;
  slug: string;
  direccion: string;
  localidad: string;
  provincia: string;
  horarios: string | null;
  whatsapp: string | null;
  telefono: string | null;
}

/** Pedido completo (vista admin u óptica). */
export interface Pedido {
  id: string;
  numero: string;
  estado: EstadoPedido;
  estadoPago: EstadoPago;
  metodoPago: MetodoPago;
  cuotas: number | null;
  canal: CanalPedido;
  createdAt: string;
  pagadoEn: string | null;
  reservaExpiraEn: string | null;
  asignadoEn: string | null;
  aceptadoEn: string | null;
  enviadoEn: string | null;
  entregadoEn: string | null;
  numeroSeguimiento: string | null;
  cliente: { email: string; nombre: string; dni: string | null; telefono: string | null };
  entrega: {
    modalidad: Modalidad;
    direccion: string | null;
    piso: string | null;
    localidad: string | null;
    provincia: string | null;
    codigoPostal: string | null;
    lat: number | null;
    lng: number | null;
    direccionCompleta: string | null;
    optica: PedidoOpticaRef | null;
  };
  items: PedidoItem[];
  totales: {
    subtotal: number;
    descuentos: number;
    envio: number;
    total: number;
    detalle: Array<{ tipo: string; codigo: string | null; descripcion: string; monto: number }>;
  };
  cuponCodigo: string | null;
  receta: Receta | null;
  notas: string | null;
  numeroFactura: string | null;
  pago: {
    id: string;
    estado: string;
    proveedor: string;
    preferenciaId: string | null;
    comprobanteUrl: string | null;
    comprobanteNombre: string | null;
    comprobanteSubidoEn: string | null;
  } | null;
  eventos?: PedidoEvento[];
  solicitudes?: Solicitud[];
  turnos?: Turno[];
  reembolsos?: Reembolso[];
  reembolsado?: number;
  aceptarAntesDe?: string | null;
  comision?: { porcentaje: number | null; monto: number | null };
  // Sólo admin
  notasInternas?: string | null;
  opticasExcluidas?: string[];
  emails?: EmailEnviado[];
  pagos?: Array<{
    id: string;
    metodo: MetodoPago;
    proveedor: string;
    externoId: string | null;
    estado: string;
    monto: number;
    comprobanteUrl: string | null;
    comprobanteNombre: string | null;
    createdAt: string;
  }>;
}

export interface OpticaCandidata {
  id: string;
  nombre: string;
  localidad: string;
  activa: boolean;
  radioKm: number;
  capacidadDiaria: number;
  asignadosHoy: number;
  distanciaKm: number | null;
  dentroRadio: boolean;
  conCupo: boolean;
  excluida: boolean;
  elegible: boolean;
  actual: boolean;
}

export type PedidoAdmin = Pedido & { candidatas: OpticaCandidata[] };

/** Fila del listado del admin. */
export interface PedidoFila {
  id: string;
  numero: string;
  estado: EstadoPedido;
  estadoPago: EstadoPago;
  metodoPago: MetodoPago;
  canal: CanalPedido;
  cliente: { email: string; nombre: string; dni: string | null };
  optica: { id: string; nombre: string } | null;
  modalidad: Modalidad;
  localidad: string | null;
  lineas: Linea[];
  total: number;
  items: number;
  solicitudes: number;
  createdAt: string;
  asignadoEn: string | null;
  aceptarAntesDe: string | null;
  entregadoEn: string | null;
}

export interface PedidosResumen {
  porEstado: Partial<Record<EstadoPedido, number>>;
  porPago: Partial<Record<EstadoPago, number>>;
  sinAsignar: number;
  solicitudesPendientes: number;
}

/** Fila del listado de la óptica. */
export interface PedidoOpticaFila {
  id: string;
  numero: string;
  estado: EstadoPedido;
  modalidad: Modalidad;
  cliente: { nombre: string; telefono: string | null };
  localidad: string | null;
  lineas: Linea[];
  conReceta: boolean;
  items: number;
  turnos: number;
  total: number;
  asignadoEn: string | null;
  aceptarAntesDe: string | null;
  aceptadoEn: string | null;
  entregadoEn: string | null;
  createdAt: string;
}

export interface SolicitudFila extends Solicitud {
  pedido: {
    id: string;
    numero: string;
    nombre: string;
    email: string;
    estado: EstadoPedido;
    total: number;
    optica: { id: string; nombre: string } | null;
  };
}

export interface LiquidacionPedido {
  id: string;
  numero: string;
  entregadoEn: string | null;
  cliente: string;
  total: number;
  comisionPct: number;
  comision: number;
  items: number;
}

export interface Liquidacion {
  mes: string;
  desde: string;
  hasta: string;
  optica: { id: string; nombre: string; comisionPct: number } | null;
  pedidos: LiquidacionPedido[];
  cantidad: number;
  monto: number;
  comision: number;
}

export interface LiquidacionGeneral {
  mes: string;
  desde: string;
  hasta: string;
  items: Array<{
    optica: { id: string; nombre: string; activa: boolean; comisionPct: number };
    cantidad: number;
    monto: number;
    comision: number;
  }>;
  totales: { cantidad: number; monto: number; comision: number };
}

export interface OpticaMe {
  usuario: { id: string; email: string; nombre: string | null };
  optica: {
    id: string;
    nombre: string;
    slug: string;
    razonSocial: string | null;
    cuit: string | null;
    direccion: string;
    localidad: string;
    provincia: string;
    codigoPostal: string;
    telefono: string | null;
    whatsapp: string | null;
    email: string | null;
    horarios: string | null;
    opticoResponsable: string | null;
    matricula: string | null;
    radioKm: number;
    capacidadDiaria: number;
    comisionPct: number;
    activa: boolean;
  };
  resumen: { pendientes: number; enCurso: number; turnosHoy: number };
}

/** Mes actual en formato AAAA-MM (hora de Argentina). */
export function mesActual(): string {
  const local = new Date(Date.now() - 3 * 3600_000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMes(mes: string): string {
  const [a, m] = mes.split('-');
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const idx = Number(m) - 1;
  return `${nombres[idx] ?? m} ${a}`;
}
