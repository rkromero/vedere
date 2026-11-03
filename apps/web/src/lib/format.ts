// Formateo y etiquetas compartidas (admin y tienda).

export const LABELS = {
  linea: {
    SOL: 'Sol',
    RECETADO: 'Recetado',
    MULTIFOCAL: 'Multifocal',
    ACCESORIO: 'Accesorio',
  },
  forma: {
    REDONDO: 'Redondo',
    CUADRADO: 'Cuadrado',
    OJO_DE_GATO: 'Ojo de gato',
    AVIADOR: 'Aviador',
    RECTANGULAR: 'Rectangular',
  },
  genero: { UNISEX: 'Unisex', MUJER: 'Mujer', HOMBRE: 'Hombre' },
  material: {
    ACETATO: 'Acetato',
    METAL: 'Metal',
    TITANIO: 'Titanio',
    TR90: 'TR90',
    MIXTO: 'Mixto',
    OTRO: 'Otro',
  },
  estado: { BORRADOR: 'Borrador', PUBLICADO: 'Publicado', ARCHIVADO: 'Archivado' },
  tipoImagen: {
    FRENTE: 'Frente',
    PERFIL: 'Perfil',
    TRES_CUARTOS: '3/4',
    PUESTO: 'Puesto',
    OTRA: 'Otra',
  },
  rol: { ADMIN: 'Admin', OPERADOR: 'Operador', OPTICA: 'Óptica', CLIENTE: 'Cliente' },
} as const;

export type Linea = keyof typeof LABELS.linea;
export type Forma = keyof typeof LABELS.forma;
export type Genero = keyof typeof LABELS.genero;
export type Material = keyof typeof LABELS.material;
export type EstadoProducto = keyof typeof LABELS.estado;
export type TipoImagen = keyof typeof LABELS.tipoImagen;
export type Rol = keyof typeof LABELS.rol;

export function options<T extends Record<string, string>>(labels: T) {
  return Object.entries(labels).map(([value, label]) => ({
    value: value as keyof T & string,
    label,
  }));
}

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export function formatPrecio(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return ars.format(value);
}

const TZ = 'America/Argentina/Buenos_Aires';
const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha determinística (misma salida en servidor y navegador): dd/mm/aaaa [hh:mm], hora de Argentina. */
export function formatFecha(value: string | Date | null | undefined, conHora = false): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const fecha = `${get('day')}/${get('month')}/${get('year')}`;
  if (!conHora) return fecha;
  return `${fecha} ${pad(Number(get('hour')))}:${get('minute')}`;
}

export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

/** Tono de badge según estado de producto (usable en server y client). */
export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';
export function estadoTone(estado: string): BadgeTone {
  if (estado === 'PUBLICADO') return 'ok';
  if (estado === 'ARCHIVADO') return 'neutral';
  return 'warn';
}
