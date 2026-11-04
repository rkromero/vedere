// Tipos y etiquetas del canal mayorista (portal de la óptica y backoffice). Sin 'use client': se usa en
// server y client components.
import type { BadgeTone } from './format';

export type EstadoPedidoMayorista =
  | 'PENDIENTE_APROBACION'
  | 'EN_REVISION'
  | 'APROBADO'
  | 'EN_PREPARACION'
  | 'LISTO_PARA_RETIRO'
  | 'DESPACHADO'
  | 'ENTREGADO'
  | 'CANCELADO';
export type EntregaMayorista = 'ENVIO_TRANSPORTE' | 'RETIRO_DEPOSITO';
export type TipoMinimo = 'NINGUNO' | 'UNIDADES' | 'MONTO';

export const ESTADO_MAYORISTA: Record<EstadoPedidoMayorista, { label: string; tone: BadgeTone }> = {
  PENDIENTE_APROBACION: { label: 'Pendiente de aprobación', tone: 'warn' },
  EN_REVISION: { label: 'En revisión', tone: 'warn' },
  APROBADO: { label: 'Aprobado', tone: 'info' },
  EN_PREPARACION: { label: 'En preparación', tone: 'info' },
  LISTO_PARA_RETIRO: { label: 'Listo para retirar', tone: 'info' },
  DESPACHADO: { label: 'Despachado', tone: 'info' },
  ENTREGADO: { label: 'Entregado', tone: 'ok' },
  CANCELADO: { label: 'Cancelado', tone: 'danger' },
};

export const ENTREGA_LABEL: Record<EntregaMayorista, string> = {
  ENVIO_TRANSPORTE: 'Envío por transporte',
  RETIRO_DEPOSITO: 'Retiro en el depósito',
};

export const MINIMO_LABEL: Record<TipoMinimo, string> = {
  NINGUNO: 'Sin mínimo',
  UNIDADES: 'Por unidades',
  MONTO: 'Por monto (sin IVA)',
};

export interface PrecioOptica {
  lista: number;
  descuentoPct: number;
  unitario: number;
  iva: number;
  conIva: number;
  ivaPct: number;
  sugerido: number;
  ganancia: number;
  margenPct: number | null;
}

export interface VarianteMayorista {
  id: string;
  sku: string;
  colorArmazon: string;
  colorArmazonHex: string | null;
  colorLente: string | null;
  colorLenteHex: string | null;
  disponible: number;
  imagen: string | null;
  imagenes: Array<{ id: string; url: string; urlMediana: string | null; urlMiniatura: string | null; alt: string | null }>;
}

export interface ProductoMayorista {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  linea: string;
  forma: string | null;
  material: string | null;
  genero: string;
  calibreMm: number | null;
  puenteMm: number | null;
  varillaMm: number | null;
  marca: { id: string; nombre: string; slug: string } | null;
  coleccion: { id: string; nombre: string; slug: string } | null;
  categorias: Array<{ id: string; nombre: string; slug: string }>;
  precio: PrecioOptica;
  variantes: VarianteMayorista[];
}

export interface FiltrosMayorista {
  categorias: Array<{ id: string; nombre: string; slug: string }>;
  marcas: Array<{ id: string; nombre: string; slug: string }>;
  colecciones: Array<{ id: string; nombre: string; slug: string }>;
  lineas: Array<{ valor: string; cantidad: number }>;
  formas: Array<{ valor: string; cantidad: number }>;
  colores: Array<{ valor: string; hex: string | null; cantidad: number }>;
}

export interface EstadoMinimo {
  tipo: TipoMinimo;
  valor: number;
  propio: boolean;
  cumple: boolean;
  falta: number;
  mensaje: string | null;
}

export interface OpcionesEntrega {
  envio: { direccion: string; modo: 'COSTO_FIJO' | 'A_CARGO_OPTICA'; costo: number } | null;
  retiro: { direccion: string; horario: string | null } | null;
}

export interface Condiciones {
  descuentoPct: number;
  ivaPct: number;
  minimo: { tipo: TipoMinimo; valor: number; propio: boolean };
  entrega: OpcionesEntrega;
}

export interface AjusteStock {
  varianteId: string;
  sku: string;
  nombre: string;
  color: string;
  pedida: number;
  disponible: number;
  motivo: 'sin_stock' | 'ajustada' | 'no_disponible';
}

export interface LineaCarrito {
  varianteId: string;
  productoId: string;
  slug: string;
  nombre: string;
  sku: string;
  color: string;
  imagen: string | null;
  cantidad: number;
  disponible: number;
  precioMayorista: number;
  precioUnitario: number;
  precioPublico: number;
  total: number;
}

export interface CarritoMayorista {
  lineas: LineaCarrito[];
  problemas: AjusteStock[];
  unidades: number;
  subtotalLista: number;
  descuentoPct: number;
  descuento: number;
  subtotal: number;
  ivaPct: number;
  iva: number;
  total: number;
  minimo: EstadoMinimo;
  entrega: OpcionesEntrega;
  ajustes?: AjusteStock[];
}

export interface PedidoMayorista {
  id: string;
  numero: string;
  estado: EstadoPedidoMayorista;
  optica: { id: string; nombre: string; slug: string; cuit: string | null; razonSocial: string | null; email: string | null; telefono: string | null };
  usuarioNombre: string;
  usuarioEmail: string;
  entrega: EntregaMayorista;
  direccionEntrega: string;
  envioACargoOptica: boolean;
  unidades: number;
  subtotalLista: number;
  descuentoPct: number;
  descuento: number;
  subtotal: number;
  envio: number;
  ivaPct: number;
  iva: number;
  total: number;
  notas: string | null;
  notasInternas?: string | null;
  motivoCancelacion: string | null;
  repetidoDeId: string | null;
  numeroSeguimiento: string | null;
  transporte: string | null;
  linkSeguimiento: string | null;
  numeroRemito: number | null;
  numeroFactura: string | null;
  motivoRevision: string | null;
  plazoPagoDias: number | null;
  venceEn: string | null;
  pagado: number;
  pendiente: number;
  estadoPago: EstadoPago;
  vencido: boolean;
  aprobadoEn: string | null;
  enPreparacionEn: string | null;
  listoParaRetiroEn: string | null;
  despachadoEn: string | null;
  entregadoEn: string | null;
  canceladoEn: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    varianteId: string | null;
    productoId: string | null;
    nombre: string;
    sku: string;
    color: string;
    imagen: string | null;
    precioMayorista: number;
    descuentoPct: number;
    precioUnitario: number;
    precioPublico: number | null;
    cantidad: number;
    total: number;
  }>;
  eventos?: EventoPedidoMayorista[];
  devoluciones?: DevolucionMayorista[];
}

export interface EventoPedidoMayorista {
  id: string;
  tipo: string;
  estado: EstadoPedidoMayorista | null;
  nota: string | null;
  interno: boolean;
  usuarioNombre: string | null;
  createdAt: string;
}

export type EstadoDevolucion = 'SOLICITADA' | 'APROBADA' | 'RECHAZADA';

export const ESTADO_DEVOLUCION: Record<EstadoDevolucion, { label: string; tone: BadgeTone }> = {
  SOLICITADA: { label: 'Solicitada', tone: 'warn' },
  APROBADA: { label: 'Aprobada', tone: 'ok' },
  RECHAZADA: { label: 'Rechazada', tone: 'danger' },
};

export interface DevolucionMayorista {
  id: string;
  pedidoId: string;
  estado: EstadoDevolucion;
  motivo: string;
  fotos: string[];
  usuarioNombre: string;
  importe: number;
  motivoRechazo: string | null;
  resueltoEn: string | null;
  createdAt: string;
  items: Array<{ id: string; pedidoItemId: string; nombre: string; sku: string; color: string; cantidad: number; total: number }>;
  pedido?: { id: string; numero: string };
  optica?: { id: string; nombre: string };
}

export type EstadoPago = 'NO_APLICA' | 'IMPAGO' | 'PARCIAL' | 'PAGADO';

export const ESTADO_PAGO: Record<EstadoPago, { label: string; tone: BadgeTone }> = {
  NO_APLICA: { label: '—', tone: 'neutral' },
  IMPAGO: { label: 'Impago', tone: 'warn' },
  PARCIAL: { label: 'Pago parcial', tone: 'info' },
  PAGADO: { label: 'Pagado', tone: 'ok' },
};

// ---------- Cuenta corriente ----------

export type MedioPago = 'TRANSFERENCIA' | 'ECHEQ' | 'EFECTIVO';
export const MEDIO_PAGO: Record<MedioPago, string> = { TRANSFERENCIA: 'Transferencia', ECHEQ: 'E-cheq', EFECTIVO: 'Efectivo' };

export type TipoMovimiento = 'DEBITO_PEDIDO' | 'PAGO' | 'NOTA_CREDITO' | 'CREDITO_LIQUIDACION' | 'AJUSTE';

export interface PedidoConDeuda {
  id: string;
  numero: string;
  total: number;
  pagado: number;
  pendiente: number;
  venceEn: string;
  diasVencido: number;
}

export interface ResumenCuenta {
  opticaId: string;
  limiteCredito: number;
  plazoPagoDias: number;
  saldo: number;
  comprometido: number;
  disponible: number;
  deudaVencida: number;
  deudaEnMora: number;
  diasTolerancia: number;
  proximosVencimientos: PedidoConDeuda[];
  vencidos: PedidoConDeuda[];
}

export interface MovimientoCuenta {
  id: string;
  tipo: TipoMovimiento;
  tipoLabel: string;
  importe: number;
  fecha: string;
  descripcion: string;
  motivo: string | null;
  medio: MedioPago | null;
  referencia: string | null;
  comprobanteUrl: string | null;
  vencimiento: string | null;
  liquidacionMes: string | null;
  pedido: { id: string; numero: string } | null;
  imputaciones: Array<{ pedidoId: string; numero: string; monto: number }>;
  creadoPorNombre: string | null;
  saldo: number;
}

export interface MovimientosPaginados {
  items: MovimientoCuenta[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  saldo: number;
}

export type EstadoPagoInformado = 'PENDIENTE' | 'VALIDADO' | 'RECHAZADO';
export const ESTADO_PAGO_INFORMADO: Record<EstadoPagoInformado, { label: string; tone: BadgeTone }> = {
  PENDIENTE: { label: 'Pendiente de validar', tone: 'warn' },
  VALIDADO: { label: 'Validado', tone: 'ok' },
  RECHAZADO: { label: 'Rechazado', tone: 'danger' },
};

export interface PagoInformado {
  id: string;
  optica: { id: string; nombre: string };
  usuarioNombre: string;
  importe: number;
  medio: MedioPago;
  fechaPago: string;
  referencia: string | null;
  comprobanteUrl: string;
  comprobanteNombre: string | null;
  notas: string | null;
  pedidoIds: string[];
  estado: EstadoPagoInformado;
  motivoRechazo: string | null;
  revisadoEn: string | null;
  createdAt: string;
  imputaciones: Array<{ pedidoId: string; numero: string; monto: number }>;
}

export interface CuentaListado {
  optica: { id: string; nombre: string; activa: boolean };
  limiteCredito: number;
  plazoPagoDias: number;
  saldo: number;
  deudaVencida: number;
}

export interface DashboardMayorista {
  mes: string;
  ventasMes: number;
  pedidosDespachadosMes: number;
  pedidosMes: number;
  montoPedidosMes: number;
  enRevision: number;
  porPreparar: number;
  devolucionesPendientes: number;
  pagosInformadosPendientes: number;
  deudaTotal: number;
  deudaVencida: number;
  opticasConDeudaVencida: number;
}

export const numeroRemito = (n: number) => `R-${String(n).padStart(6, '0')}`;

export interface ConfigMayorista {
  ivaPct: number;
  minimoTipo: TipoMinimo;
  minimoValor: number;
  envioHabilitado: boolean;
  envioModo: 'COSTO_FIJO' | 'A_CARGO_OPTICA';
  envioCosto: number;
  retiroHabilitado: boolean;
  retiroDireccion: string | null;
  retiroHorario: string | null;
  diasToleranciaVencida: number;
}

/** Texto para avisar ajustes de stock (catálogo, carrito y "repetir pedido"). */
export function textoAjuste(a: AjusteStock): string {
  const quien = `${a.nombre} ${a.color} (${a.sku})`;
  if (a.motivo === 'no_disponible') return `${quien}: ya no está en el catálogo mayorista.`;
  if (a.motivo === 'sin_stock') return `${quien}: sin stock, no se agregó (pediste ${a.pedida}).`;
  return `${quien}: pediste ${a.pedida} y hay ${a.disponible}; se agregaron ${a.disponible}.`;
}

/** Clave de sessionStorage para mostrar en el carrito los avisos de "repetir pedido". */
export const AJUSTES_KEY = 'vedere_mayorista_ajustes';
