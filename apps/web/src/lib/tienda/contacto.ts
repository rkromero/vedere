// Motivos del formulario de contacto (módulo plano: lo importan server y client components).
export const MOTIVOS = [
  { value: 'CONSULTA', label: 'Consulta general' },
  { value: 'TURNO', label: 'Pedir turno (multifocales / asesoramiento)' },
  { value: 'CAMBIO', label: 'Cambio o devolución' },
  { value: 'ARREPENTIMIENTO', label: 'Botón de arrepentimiento' },
  { value: 'OPTICA', label: 'Quiero sumar mi óptica' },
  { value: 'OTRO', label: 'Otro' },
] as const;
export type Motivo = (typeof MOTIVOS)[number]['value'];
