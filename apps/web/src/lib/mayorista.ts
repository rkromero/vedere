// Tipos y etiquetas del canal mayorista (portal de la óptica y backoffice). Sin 'use client': se usa en
// server y client components.
import type { BadgeTone } from './format';

export type EstadoPedidoMayorista = 'PENDIENTE_APROBACION' | 'APROBADO' | 'DESPACHADO' | 'ENTREGADO' | 'CANCELADO';
export type EntregaMayorista = 'ENVIO_TRANSPORTE' | 'RETIRO_DEPOSITO';
export type TipoMinimo = 'NINGUNO' | 'UNIDADES' | 'MONTO';

export const ESTADO_MAYORISTA: Record<EstadoPedidoMayorista, { label: string; tone: BadgeTone }> = {
  PENDIENTE_APROBACION: { label: 'Pendiente de aprobación', tone: 'warn' },
  APROBADO: { label: 'Aprobado', tone: 'info' },
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
  aprobadoEn: string | null;
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
}

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
