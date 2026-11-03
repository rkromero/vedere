// Tipos de la tienda pública (respuestas de /catalogo/* y estado del carrito).
import type { Forma, Genero, Linea, Material } from '@/lib/format';

export interface Coleccion {
  id: string;
  nombre: string;
  slug: string;
  colorHex: string;
  bannerUrl: string | null;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  productos: number;
  portadaUrl: string | null;
  portadaMedianaUrl: string | null;
}

export interface Filtros {
  formas: Array<{ valor: Forma; cantidad: number }>;
  materiales: Array<{ valor: Material; cantidad: number }>;
  generos: Array<{ valor: Genero; cantidad: number }>;
  lineas: Array<{ valor: Linea; cantidad: number }>;
  colores: Array<{ valor: string; hex: string | null; cantidad: number }>;
  precio: { min: number; max: number };
}

export interface PromoMensaje {
  id: string;
  texto: string;
  link: string | null;
}

export interface Optica {
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
  distanciaKm?: number | null;
  distanciaCp?: number | null;
}

export interface Sugerencias {
  productos: Array<{
    id: string;
    nombre: string;
    slug: string;
    linea: Linea;
    precio: number;
    precioLista: number | null;
    imagen: string | null;
    marca: string | null;
  }>;
  categorias: Array<{ id: string; nombre: string; slug: string }>;
  colecciones: Array<{ id: string; nombre: string; slug: string; colorHex: string }>;
}

export interface CuponAplicado {
  codigo: string;
  descripcion: string | null;
  tipo: 'PORCENTAJE' | 'MONTO';
  valor: number;
  minimoCompra: number | null;
}

/** Ítem del carrito: snapshot de lo necesario para mostrarlo sin volver a pedir el producto. */
export interface CartItem {
  varianteId: string;
  productoId: string;
  slug: string;
  nombre: string;
  sku: string;
  color: string;
  colorHex: string | null;
  precio: number;
  precioLista: number | null;
  imagen: string | null;
  cantidad: number;
  stock: number;
  conReceta: boolean;
  linea: Linea;
}
