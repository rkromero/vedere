// Estimación de entrega para la ficha: hoy + N días hábiles (lunes a viernes), en hora local.
// Se calcula en el cliente (useEffect) para que el HTML del servidor no dependa de la fecha.

export function fechaEntregaEstimada(diasHabiles = 5, desde: Date = new Date()): Date {
  const d = new Date(desde);
  let restantes = diasHabiles;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) restantes -= 1;
  }
  return d;
}

/** "viernes, 7 de noviembre" */
export function formatFechaEntrega(fecha: Date): string {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(fecha);
}
