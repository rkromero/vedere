// Tipos y etiquetas del checkout (respuestas de /checkout/*). Módulo plano: sirve en server y client.
import type { Linea } from '@/lib/format';

export type Modalidad = 'RETIRO_OPTICA' | 'ENVIO_DOMICILIO';
export type MetodoPago = 'MERCADO_PAGO' | 'MERCADO_PAGO_BILLETERA' | 'TRANSFERENCIA';
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
export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'REEMBOLSADO';
export type ModoReceta = 'VALORES' | 'ARCHIVO' | 'OPTICA';

export const LINEAS_CON_RECETA: Linea[] = ['RECETADO', 'MULTIFOCAL'];

/** Etiquetas para el cliente (la tienda); el admin usa las de lib/pedidos. */
export const ESTADO_PEDIDO_LABEL: Record<EstadoPedido, string> = {
  PENDIENTE_PAGO: 'Pendiente de pago',
  PAGADO: 'Pago confirmado',
  ASIGNADO: 'En tu óptica',
  ACEPTADO: 'Confirmado por tu óptica',
  EN_ARMADO: 'En armado',
  LISTO: 'Listo para retirar',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  DEVUELTO: 'Devuelto',
};
export const ESTADO_PAGO_LABEL: Record<EstadoPago, string> = {
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  REEMBOLSADO: 'Reembolsado',
};
export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  MERCADO_PAGO: 'Mercado Pago',
  MERCADO_PAGO_BILLETERA: 'Billetera / QR Mercado Pago',
  TRANSFERENCIA: 'Transferencia bancaria',
};
export const MODALIDAD_LABEL: Record<Modalidad, string> = {
  RETIRO_OPTICA: 'Retiro en la óptica',
  ENVIO_DOMICILIO: 'Envío a domicilio',
};

export interface ConfigCheckout {
  mercadoPago: boolean;
  mercadoPagoBilletera: boolean;
  transferencia: {
    cbu: string | null;
    alias: string | null;
    titular: string | null;
    banco: string | null;
    descuento: number;
    horasReserva: number;
  } | null;
  cuotas: { cuotasGeneral: number; cuotasPorLinea: Partial<Record<Linea, number>> };
  costoEnvio: number;
  places: boolean;
  reservaMinutos: number;
}

export const CONFIG_FALLBACK: ConfigCheckout = {
  mercadoPago: false,
  mercadoPagoBilletera: false,
  transferencia: null,
  cuotas: { cuotasGeneral: 6, cuotasPorLinea: {} },
  costoEnvio: 0,
  places: false,
  reservaMinutos: 30,
};

export interface DescuentoAplicado {
  tipo: 'PROMO' | 'CUPON' | 'TRANSFERENCIA';
  id?: string;
  codigo?: string;
  descripcion: string;
  monto: number;
}

export interface Cotizacion {
  items: Array<{
    varianteId: string;
    productoId: string;
    nombre: string;
    precio: number;
    precioLista: number | null;
    cantidad: number;
    linea: Linea;
    imagen: string | null;
    color: string;
    stock: number;
    disponible: number;
    descuento: number;
    total: number;
  }>;
  totales: {
    subtotal: number;
    ahorroLista: number;
    descuentos: DescuentoAplicado[];
    descuentoTotal: number;
    envio: number;
    envioGratis: boolean;
    envioGratisPor: string | null;
    total: number;
    ahorroTotal: number;
    cuponError: string | null;
    promosDescartadas: string[];
  };
  cupon: { codigo: string; descripcion: string | null } | null;
  cuponError: string | null;
  requiereReceta: boolean;
  lineas: Linea[];
  cuotas: { cantidad: number; valorCuota: number };
  sinStock: Array<{ varianteId: string; disponible: number }>;
}

export interface OpticaAsignada {
  id: string;
  nombre: string;
  slug: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  horarios: string | null;
  whatsapp: string | null;
  telefono: string | null;
  lat: number | null;
  lng: number | null;
  distanciaKm: number | null;
  criterio: 'coordenadas' | 'codigo_postal' | 'orden';
}

export interface DireccionNormalizada {
  placeId: string | null;
  direccionCompleta: string;
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  lat: number;
  lng: number;
}

export interface RecetaValores {
  odEsfera: number;
  odCilindro: number;
  odEje: number;
  oiEsfera: number;
  oiCilindro: number;
  oiEje: number;
  adicion: number | null;
  dp: number | null;
  notas?: string | null;
}

export interface Receta extends Partial<RecetaValores> {
  id: string;
  modo: ModoReceta;
  archivoUrl: string | null;
  archivoNombre: string | null;
  createdAt: string;
}

export type RecetaInput =
  | { modo: 'VALORES'; valores: RecetaValores }
  | { modo: 'ARCHIVO'; archivoUrl: string; archivoNombre?: string }
  | { modo: 'OPTICA' }
  | { modo: 'GUARDADA'; recetaId: string };

export interface PedidoPublico {
  id: string;
  numero: string;
  estado: EstadoPedido;
  estadoPago: EstadoPago;
  metodoPago: MetodoPago;
  cuotas: number;
  createdAt: string;
  pagadoEn: string | null;
  reservaExpiraEn: string | null;
  cliente: { email: string; nombre: string; dni: string; telefono: string };
  entrega: {
    modalidad: Modalidad;
    direccion: string;
    piso: string | null;
    localidad: string;
    provincia: string;
    codigoPostal: string;
    lat: number | null;
    lng: number | null;
    direccionCompleta: string | null;
    optica: {
      id: string;
      nombre: string;
      slug: string;
      direccion: string;
      localidad: string;
      provincia: string;
      horarios: string | null;
      whatsapp: string | null;
      telefono: string | null;
    } | null;
  };
  items: Array<{
    id: string;
    varianteId: string | null;
    productoId: string | null;
    nombre: string;
    sku: string;
    color: string;
    imagen: string | null;
    linea: Linea;
    precioUnitario: number;
    precioLista: number | null;
    cantidad: number;
    descuento: number;
    total: number;
    conReceta: boolean;
  }>;
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
    estado: EstadoPago;
    proveedor: string;
    preferenciaId: string | null;
    comprobanteUrl: string | null;
    comprobanteNombre: string | null;
    comprobanteSubidoEn: string | null;
  } | null;
}

/** Cuotas sin interés para una línea según la configuración comercial. */
export function cuotasParaLinea(linea: Linea | null | undefined, cfg: ConfigCheckout['cuotas']): number {
  if (linea && cfg.cuotasPorLinea[linea]) return cfg.cuotasPorLinea[linea]!;
  return cfg.cuotasGeneral;
}

/** Formato "0,25 / -1,50" para valores de receta (determinístico). */
export function formatDioptria(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const s = (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
  return v > 0 ? `+${s}` : s;
}
