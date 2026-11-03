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
  createdAt: string;
}

export interface Dashboard {
  productos: { total: number; publicados: number; borradores: number; archivados: number };
  marcas: number;
  categorias: number;
  colecciones: number;
  usuarios: number;
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
  createdAt: string;
  updatedAt: string;
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
