// Tipos de las respuestas de la API (catálogo y usuarios).
import type { EstadoProducto, Forma, Genero, Linea, Material, Rol, TipoImagen } from './format';

export interface Marca {
  id: string;
  nombre: string;
  slug: string;
  logoUrl: string | null;
  activa: boolean;
  productos?: number;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  updatedById: string | null;
}

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  padreId: string | null;
  padre?: { id: string; nombre: string; slug: string } | null;
  orden: number;
  activa: boolean;
  productos?: number;
  hijas?: Categoria[];
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  updatedById: string | null;
}

export interface Coleccion {
  id: string;
  nombre: string;
  slug: string;
  colorHex: string;
  bannerUrl: string | null;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  activa: boolean;
  productos?: number;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  updatedById: string | null;
}

export interface Imagen {
  id?: string;
  tipo: TipoImagen;
  orden: number;
  url: string;
  urlMediana: string | null;
  urlMiniatura: string | null;
  alt: string | null;
}

export interface Variante {
  id: string;
  productoId: string;
  colorArmazon: string;
  colorArmazonHex: string | null;
  colorLente: string | null;
  colorLenteHex: string | null;
  sku: string;
  stock: number;
  stockMinimo: number;
  bajoStock: boolean;
  activa: boolean;
  orden: number;
  imagenes: Imagen[];
  createdAt: string;
  updatedAt: string;
  createdById?: string | null;
  updatedById?: string | null;
}

export interface Producto {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string;
  marca: { id: string; nombre: string; slug: string; logoUrl: string | null } | null;
  marcaId: string | null;
  coleccion: { id: string; nombre: string; slug: string; colorHex: string } | null;
  coleccionId: string | null;
  categorias: Array<{ id: string; nombre: string; slug: string; padreId: string | null }>;
  linea: Linea;
  material: Material | null;
  forma: Forma | null;
  genero: Genero;
  medidas: { calibreMm: number | null; puenteMm: number | null; varillaMm: number | null };
  precio: number;
  precioLista: number | null;
  /** Sólo en el admin (las respuestas públicas nunca lo incluyen). Precio a ópticas, sin IVA. */
  precioMayorista?: number | null;
  /** Sólo en el admin: visibilidad por canal. */
  visibleTienda?: boolean;
  visibleMayorista?: boolean;
  permiteReceta: boolean;
  destacado: boolean;
  edicionLimitada: boolean;
  /** Publicado hace menos de 45 días (lo calcula la API). */
  nuevo: boolean;
  estado: EstadoProducto;
  seo: { title: string | null; description: string | null };
  vendidos: number;
  publicadoEn: string | null;
  stockTotal: number;
  variantes: Variante[];
  imagenPrincipal: string | null;
  createdAt: string;
  updatedAt: string;
  createdById?: string | null;
  updatedById?: string | null;
}

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
  /** Sólo rol OPTICA: óptica a la que pertenece. */
  opticaId?: string | null;
  optica?: { id: string; nombre: string; slug: string } | null;
  createdAt: string;
}

export interface Dashboard {
  productos: { total: number; publicados: number; borradores: number; archivados: number };
  marcas: number;
  categorias: number;
  colecciones: number;
  usuarios: number;
  pedidos: {
    porEstado: Partial<Record<string, number>>;
    sinAsignar: number;
    vencidos: number;
    solicitudesPendientes: number;
  };
  opticasActivas: number;
  variantesBajoStock: Array<{
    id: string;
    sku: string;
    colorArmazon: string;
    stock: number;
    stockMinimo: number;
    faltante: number;
    producto: { id: string; nombre: string; slug: string; estado: string };
  }>;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------- Tienda (admin) ----------
export interface PromoMensajeAdmin {
  id: string;
  texto: string;
  link: string | null;
  orden: number;
  activo: boolean;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpticaAdmin {
  id: string;
  nombre: string;
  slug: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  horarios: string | null;
  activa: boolean;
  orden: number;
  // Prompt 5: datos fiscales, cobertura y operación
  razonSocial: string | null;
  cuit: string | null;
  radioKm: number;
  opticoResponsable: string | null;
  matricula: string | null;
  comisionPct: number;
  capacidadDiaria: number;
  // B2B 1
  condicionIva?: CondicionIva | null;
  habilitacionUrl?: string | null;
  // B2B 2: descuento sobre el precio mayorista y compra mínima propia (null = la general).
  descuentoPct?: number;
  minimoTipo?: 'NINGUNO' | 'UNIDADES' | 'MONTO' | null;
  minimoValor?: number | null;
  // B2B 3: cuenta corriente (en B2B 4 lo define el nivel).
  limiteCredito?: number;
  plazoPagoDias?: number;
  /** Pedidos asignados hoy (lo calcula la API en el listado). */
  asignadosHoy?: number;
  usuarios?: number;
  pedidos?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OpticaMapaItem {
  id: string;
  nombre: string;
  slug: string;
  direccion: string;
  localidad: string;
  provincia: string;
  lat: number;
  lng: number;
  radioKm: number;
  activa: boolean;
  capacidadDiaria: number;
}

export type TipoCupon = 'PORCENTAJE' | 'MONTO';
export interface Cupon {
  id: string;
  codigo: string;
  descripcion: string | null;
  tipo: TipoCupon;
  valor: number;
  minimoCompra: number | null;
  usosMax: number | null;
  usos: number;
  activo: boolean;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MotivoContacto = 'CONSULTA' | 'TURNO' | 'CAMBIO' | 'ARREPENTIMIENTO' | 'OPTICA' | 'OTRO';
export interface MensajeContacto {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  motivo: MotivoContacto;
  mensaje: string;
  pedido: string | null;
  leidoEn: string | null;
  createdAt: string;
}

export interface AvisoStock {
  id: string;
  email: string;
  varianteId: string;
  notificadoEn: string | null;
  createdAt: string;
  variante: {
    id: string;
    sku: string;
    colorArmazon: string;
    stock: number;
    producto: { id: string; nombre: string; slug: string };
  };
}

export interface SuscripcionNewsletter {
  id: string;
  email: string;
  origen: string | null;
  createdAt: string;
}

// ---------- B2B 1: alta de ópticas ----------
export type CondicionIva = 'RESPONSABLE_INSCRIPTO' | 'MONOTRIBUTO' | 'EXENTO';
export type EstadoSolicitudOptica = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export interface SolicitudOptica {
  id: string;
  razonSocial: string;
  nombreComercial: string;
  cuit: string;
  condicionIva: CondicionIva;
  direccion: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  telefono: string;
  whatsapp: string | null;
  email: string;
  opticoResponsable: string;
  matricula: string;
  habilitacionUrl: string;
  habilitacionNombre: string | null;
  aceptaTerminosEn: string;
  estado: EstadoSolicitudOptica;
  motivoRechazo: string | null;
  opticaId: string | null;
  optica: { id: string; nombre: string; slug: string } | null;
  usuarioId: string | null;
  resueltoEn: string | null;
  createdAt: string;
}

export interface SolicitudOpticaDetalle extends SolicitudOptica {
  coincidencias: Array<{ id: string; nombre: string; slug: string; localidad: string; activa: boolean }>;
  usuarioExistente: { id: string; rol: string; opticaId: string | null; activo: boolean } | null;
}
