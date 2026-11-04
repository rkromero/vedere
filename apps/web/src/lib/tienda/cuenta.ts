// Mi cuenta (prompt 6): tipos y acceso a /cuenta/* y /auth/* según el contrato de docs/PLAN-PROMPT6.md.
// Módulo plano (sin 'use client'): los tipos y helpers sirven en server y client; `cuentaApi` usa el
// cliente same-origin de la tienda y sólo se llama desde componentes cliente.
import { tiendaApi } from './client';
import type { Producto } from '@/lib/types';
import { ESTADO_PEDIDO_LABEL } from './checkout';
import type { EstadoPedido, Modalidad, PedidoPublico, Receta } from './checkout';

export interface UsuarioCuenta {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  rol: 'ADMIN' | 'OPERADOR' | 'OPTICA' | 'CLIENTE';
  createdAt: string;
  googleVinculado: boolean;
  newsletter: boolean;
  codigoReferido: string | null;
}

export interface ResumenCuenta {
  user: UsuarioCuenta;
  resumen: { pedidos: number; recetas: number; direcciones: number; favoritos: number };
  rivedere: {
    ultimaCompraRecetado: string | null;
    proximoAviso: string | null;
    meses: number;
    descuentoPct: number;
  };
}

/** Pedido tal como lo devuelve /cuenta/pedidos (misma forma que /checkout/mis-pedidos + fechas de logística). */
export interface PedidoCuenta extends PedidoPublico {
  asignadoEn?: string | null;
  aceptadoEn?: string | null;
  enviadoEn?: string | null;
  entregadoEn?: string | null;
  numeroSeguimiento?: string | null;
  calificacion?: { puntaje: number; comentario: string | null; createdAt: string } | null;
}

export interface Direccion {
  id: string;
  etiqueta: string;
  direccion: string;
  piso: string | null;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  telefono: string | null;
  predeterminada: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type DireccionInput = Omit<Direccion, 'id' | 'createdAt' | 'updatedAt' | 'lat' | 'lng' | 'placeId'> & {
  lat?: number | null;
  lng?: number | null;
  placeId?: string | null;
};

export interface Referidos {
  codigo: string;
  link: string;
  descuentoPct: number;
  referidos: Array<{ nombre: string; estado: 'REGISTRADO' | 'COMPRO'; createdAt: string }>;
  cupones: Array<{
    codigo: string;
    descripcion: string | null;
    valor: number;
    tipo: 'PORCENTAJE' | 'MONTO';
    vigenciaHasta: string | null;
    usos: number;
    usosMax: number | null;
  }>;
}

export interface SitioConfigCuenta {
  googleLogin?: boolean;
  referidos?: { descuentoPct: number };
  rivedere?: { meses: number; descuentoPct: number };
}

export const REF_COOKIE = 'vedere_ref';

export const PROVINCIAS = [
  'Buenos Aires',
  'Ciudad Autónoma de Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
] as const;

/** Etiqueta del estado para el cliente, según modalidad ("Listo para despachar" si es envío). */
export function labelEstadoCliente(estado: EstadoPedido, modalidad?: Modalidad | null): string {
  if (estado === 'LISTO' && modalidad === 'ENVIO_DOMICILIO') return 'Listo para despachar';
  if (estado === 'ASIGNADO' && modalidad === 'ENVIO_DOMICILIO') return 'En preparación';
  return ESTADO_PEDIDO_LABEL[estado] ?? estado;
}

/** Pasos del seguimiento para el cliente (sin los terminales CANCELADO/DEVUELTO). */
export function pasosPedido(modalidad: Modalidad): EstadoPedido[] {
  return modalidad === 'ENVIO_DOMICILIO'
    ? ['PENDIENTE_PAGO', 'PAGADO', 'ASIGNADO', 'EN_ARMADO', 'LISTO', 'ENVIADO', 'ENTREGADO']
    : ['PENDIENTE_PAGO', 'PAGADO', 'ASIGNADO', 'EN_ARMADO', 'LISTO', 'ENTREGADO'];
}

const ORDEN: EstadoPedido[] = [
  'PENDIENTE_PAGO',
  'PAGADO',
  'ASIGNADO',
  'ACEPTADO',
  'EN_ARMADO',
  'LISTO',
  'ENVIADO',
  'ENTREGADO',
];

/** Índice del estado en el flujo (ACEPTADO cuenta como ASIGNADO para el cliente). */
export function indicePaso(estado: EstadoPedido, pasos: EstadoPedido[]): number {
  const efectivo = estado === 'ACEPTADO' ? 'ASIGNADO' : estado;
  const idx = pasos.indexOf(efectivo);
  if (idx >= 0) return idx;
  // Estados terminales: ubicarlos según hasta dónde llegó.
  const pos = ORDEN.indexOf(estado);
  return pos < 0 ? 0 : Math.min(pasos.length - 1, pos);
}

export function esTerminal(estado: EstadoPedido): boolean {
  return estado === 'CANCELADO' || estado === 'DEVUELTO';
}

export function nombreCorto(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || nombre;
}

/** Inicial + apellido abreviado para listas de referidos ("M. González" → "M. G."). */
export function inicialesNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '—';
  if (partes.length === 1) return `${partes[0]![0]!.toUpperCase()}.`;
  return `${partes[0]![0]!.toUpperCase()}. ${partes[partes.length - 1]![0]!.toUpperCase()}.`;
}

export function leerCookie(nombre: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

/** Sanitiza el `next` de los formularios de acceso: sólo rutas internas. */
export function nextSeguro(next: string | null | undefined, fallback = '/mi-cuenta'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}

// ---------- Llamadas desde componentes cliente ----------

export const cuentaApi = {
  login: (body: { email: string; password: string }) =>
    tiendaApi.post<{ user: UsuarioCuenta }>('/auth/login', body),
  registro: (body: { nombre: string; email: string; password: string; telefono?: string; ref?: string }) =>
    tiendaApi.post<{ user: UsuarioCuenta }>('/auth/register', body),
  logout: () => tiendaApi.post<void>('/auth/logout'),
  recuperar: (email: string) => tiendaApi.post<void>('/auth/recuperar', { email }),
  restablecer: (token: string, password: string) =>
    tiendaApi.post<void>('/auth/restablecer', { token, password }),

  resumen: () => tiendaApi.get<ResumenCuenta>('/cuenta'),
  datos: (body: { nombre: string; telefono?: string | null; newsletter?: boolean }) =>
    tiendaApi.put<{ user: UsuarioCuenta }>('/cuenta/datos', body),
  password: (body: { actual?: string; nueva: string }) => tiendaApi.put<void>('/cuenta/password', body),

  recetas: () => tiendaApi.get<{ items: Receta[] }>('/cuenta/recetas'),
  borrarReceta: (id: string) => tiendaApi.delete<void>(`/cuenta/recetas/${encodeURIComponent(id)}`),

  direcciones: () => tiendaApi.get<{ items: Direccion[] }>('/cuenta/direcciones'),
  crearDireccion: (body: DireccionInput) => tiendaApi.post<Direccion>('/cuenta/direcciones', body),
  editarDireccion: (id: string, body: DireccionInput) =>
    tiendaApi.put<Direccion>(`/cuenta/direcciones/${encodeURIComponent(id)}`, body),
  borrarDireccion: (id: string) => tiendaApi.delete<void>(`/cuenta/direcciones/${encodeURIComponent(id)}`),
  predeterminar: (id: string) =>
    tiendaApi.post<Direccion>(`/cuenta/direcciones/${encodeURIComponent(id)}/predeterminada`),

  favoritosIds: () => tiendaApi.get<{ ids: string[] }>('/cuenta/favoritos/ids'),
  favoritos: () => tiendaApi.get<{ items: Producto[] }>('/cuenta/favoritos'),
  agregarFavorito: (productoId: string) =>
    tiendaApi.put<void>(`/cuenta/favoritos/${encodeURIComponent(productoId)}`),
  quitarFavorito: (productoId: string) =>
    tiendaApi.delete<void>(`/cuenta/favoritos/${encodeURIComponent(productoId)}`),

  referidos: () => tiendaApi.get<Referidos>('/cuenta/referidos'),
};
