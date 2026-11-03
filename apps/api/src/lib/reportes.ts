// Reportes del backoffice (prompt 6). "Ventas" = total de pedidos con pago aprobado (estado_pago APROBADO y
// estado distinto de CANCELADO/DEVUELTO) por fecha de pago. Conversión = pedidos pagados del período ÷
// (carritos tocados en el período + pedidos creados en el período): aproxima "sesiones con intención de compra"
// sin analítica de terceros. Fechas en horario de Buenos Aires (UTC-3, sin horario de verano).
import { prisma } from '@vedere/db';

export interface Periodo {
  desde: string;
  hasta: string;
}

export const TZ = 'America/Argentina/Buenos_Aires';

/** YYYY-MM-DD en Buenos Aires. */
export function fechaAR(d: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function limitesPeriodo(p: Periodo): { desdeTs: Date; hastaTs: Date } {
  return { desdeTs: new Date(`${p.desde}T00:00:00-03:00`), hastaTs: new Date(`${p.hasta}T23:59:59.999-03:00`) };
}

/** Período por defecto: últimos 30 días (incluido hoy). */
export function periodoDefault(ahora = new Date()): Periodo {
  const hasta = fechaAR(ahora);
  const desde = fechaAR(new Date(ahora.getTime() - 29 * 86400_000));
  return { desde, hasta };
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00-03:00`);
  return fechaAR(new Date(d.getTime() + dias * 86400_000));
}

interface Fila {
  clave: string | null;
  nombre: string | null;
  pedidos: number;
  unidades: number;
  ventas: number;
}

interface Totales {
  ventas: number;
  pedidos: number;
}

async function totalesEntre(desdeTs: Date, hastaTs: Date): Promise<Totales> {
  const [r] = await prisma.$queryRaw<Array<{ ventas: number; pedidos: number }>>`
    SELECT COALESCE(SUM(p.total), 0)::float8 AS ventas, COUNT(*)::int AS pedidos
    FROM pedidos p
    WHERE p.estado_pago = 'APROBADO' AND p.estado NOT IN ('CANCELADO', 'DEVUELTO')
      AND p.pagado_en BETWEEN ${desdeTs} AND ${hastaTs}`;
  return { ventas: r?.ventas ?? 0, pedidos: r?.pedidos ?? 0 };
}

export async function generarReporte(periodo: Periodo, ahora = new Date()) {
  const { desdeTs, hastaTs } = limitesPeriodo(periodo);
  const hoy = fechaAR(ahora);
  const semana = { desde: sumarDias(hoy, -6), hasta: hoy };
  const mes = { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };

  const [totales, hoyT, semanaT, mesT, carritos, creados, porDia, porEstado, porLinea, porOptica, porColeccion, porCreador, masVendidos] =
    await Promise.all([
      totalesEntre(desdeTs, hastaTs),
      totalesEntre(limitesPeriodo({ desde: hoy, hasta: hoy }).desdeTs, limitesPeriodo({ desde: hoy, hasta: hoy }).hastaTs),
      totalesEntre(limitesPeriodo(semana).desdeTs, limitesPeriodo(semana).hastaTs),
      totalesEntre(limitesPeriodo(mes).desdeTs, limitesPeriodo(mes).hastaTs),
      prisma.carrito.count({ where: { updatedAt: { gte: desdeTs, lte: hastaTs } } }),
      prisma.pedido.count({ where: { createdAt: { gte: desdeTs, lte: hastaTs } } }),
      prisma.$queryRaw<Array<{ fecha: string; ventas: number; pedidos: number }>>`
        SELECT to_char(p.pagado_en AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS fecha,
               COALESCE(SUM(p.total), 0)::float8 AS ventas, COUNT(*)::int AS pedidos
        FROM pedidos p
        WHERE p.estado_pago = 'APROBADO' AND p.estado NOT IN ('CANCELADO', 'DEVUELTO')
          AND p.pagado_en BETWEEN ${desdeTs} AND ${hastaTs}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<Array<{ estado: string; cantidad: number; ventas: number }>>`
        SELECT p.estado::text AS estado, COUNT(*)::int AS cantidad, COALESCE(SUM(p.total), 0)::float8 AS ventas
        FROM pedidos p
        WHERE p.created_at BETWEEN ${desdeTs} AND ${hastaTs}
        GROUP BY 1 ORDER BY 2 DESC`,
      prisma.$queryRaw<Fila[]>`
        SELECT i.linea::text AS clave, i.linea::text AS nombre, COUNT(DISTINCT p.id)::int AS pedidos,
               COALESCE(SUM(i.cantidad), 0)::int AS unidades, COALESCE(SUM(i.total), 0)::float8 AS ventas
        FROM pedido_items i JOIN pedidos p ON p.id = i.pedido_id
        WHERE p.estado_pago = 'APROBADO' AND p.estado NOT IN ('CANCELADO', 'DEVUELTO')
          AND p.pagado_en BETWEEN ${desdeTs} AND ${hastaTs}
        GROUP BY 1 ORDER BY ventas DESC`,
      prisma.$queryRaw<Fila[]>`
        SELECT o.id AS clave, COALESCE(o.nombre, 'Sin asignar') AS nombre, COUNT(*)::int AS pedidos,
               COALESCE(SUM((SELECT SUM(i.cantidad) FROM pedido_items i WHERE i.pedido_id = p.id)), 0)::int AS unidades,
               COALESCE(SUM(p.total), 0)::float8 AS ventas
        FROM pedidos p LEFT JOIN opticas o ON o.id = p.optica_id
        WHERE p.estado_pago = 'APROBADO' AND p.estado NOT IN ('CANCELADO', 'DEVUELTO')
          AND p.pagado_en BETWEEN ${desdeTs} AND ${hastaTs}
        GROUP BY o.id, o.nombre ORDER BY ventas DESC`,
      prisma.$queryRaw<Fila[]>`
        SELECT c.id AS clave, COALESCE(c.nombre, 'Sin colección') AS nombre, COUNT(DISTINCT p.id)::int AS pedidos,
               COALESCE(SUM(i.cantidad), 0)::int AS unidades, COALESCE(SUM(i.total), 0)::float8 AS ventas
        FROM pedido_items i
        JOIN pedidos p ON p.id = i.pedido_id
        LEFT JOIN productos pr ON pr.id = i.producto_id
        LEFT JOIN colecciones c ON c.id = pr.coleccion_id
        WHERE p.estado_pago = 'APROBADO' AND p.estado NOT IN ('CANCELADO', 'DEVUELTO')
          AND p.pagado_en BETWEEN ${desdeTs} AND ${hastaTs}
        GROUP BY c.id, c.nombre ORDER BY ventas DESC`,
      prisma.$queryRaw<Fila[]>`
        SELECT cu.codigo AS clave, cr.nombre AS nombre, COUNT(*)::int AS pedidos,
               COALESCE(SUM((SELECT SUM(i.cantidad) FROM pedido_items i WHERE i.pedido_id = p.id)), 0)::int AS unidades,
               COALESCE(SUM(p.total), 0)::float8 AS ventas
        FROM pedidos p
        JOIN cupon_usos u ON u.pedido_id = p.id
        JOIN cupones cu ON cu.id = u.cupon_id
        JOIN creadores cr ON cr.id = cu.creador_id
        WHERE p.estado_pago = 'APROBADO' AND p.estado NOT IN ('CANCELADO', 'DEVUELTO')
          AND p.pagado_en BETWEEN ${desdeTs} AND ${hastaTs}
        GROUP BY cu.codigo, cr.nombre ORDER BY ventas DESC`,
      prisma.$queryRaw<Array<{ productoId: string | null; nombre: string; slug: string | null; unidades: number; ventas: number }>>`
        SELECT i.producto_id AS "productoId", MAX(i.nombre) AS nombre, MAX(pr.slug) AS slug,
               COALESCE(SUM(i.cantidad), 0)::int AS unidades, COALESCE(SUM(i.total), 0)::float8 AS ventas
        FROM pedido_items i
        JOIN pedidos p ON p.id = i.pedido_id
        LEFT JOIN productos pr ON pr.id = i.producto_id
        WHERE p.estado_pago = 'APROBADO' AND p.estado NOT IN ('CANCELADO', 'DEVUELTO')
          AND p.pagado_en BETWEEN ${desdeTs} AND ${hastaTs}
        GROUP BY i.producto_id ORDER BY unidades DESC, ventas DESC LIMIT 10`,
    ]);

  const base = carritos + creados;
  return {
    periodo,
    totales: {
      ventas: totales.ventas,
      pedidos: totales.pedidos,
      ticketPromedio: totales.pedidos ? Math.round(totales.ventas / totales.pedidos) : 0,
      conversion: { pedidosPagados: totales.pedidos, carritos: base, pct: base ? Math.round((totales.pedidos / base) * 1000) / 10 : 0 },
    },
    hoy: hoyT,
    semana: semanaT,
    mes: mesT,
    porDia,
    porEstado,
    porLinea,
    porOptica: porOptica.map((f) => ({ ...f, clave: f.clave ?? 'sin-asignar' })),
    porColeccion: porColeccion.map((f) => ({ ...f, clave: f.clave ?? 'sin-coleccion' })),
    porCreador,
    masVendidos,
  };
}

export type Reporte = Awaited<ReturnType<typeof generarReporte>>;

// ---------- CSV ----------

function celda(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function aCsv(cabecera: string[], filas: unknown[][]): string {
  return `\uFEFF${cabecera.join(',')}\n${filas.map((f) => f.map(celda).join(',')).join('\n')}\n`;
}

export async function csvPedidos(periodo: Periodo): Promise<string> {
  const { desdeTs, hastaTs } = limitesPeriodo(periodo);
  const pedidos = await prisma.pedido.findMany({
    where: { createdAt: { gte: desdeTs, lte: hastaTs } },
    include: { optica: { select: { nombre: true } }, items: { select: { cantidad: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return aCsv(
    ['numero', 'creado', 'pagado', 'estado', 'estado_pago', 'metodo_pago', 'canal', 'cliente', 'email', 'dni', 'modalidad', 'optica', 'localidad', 'provincia', 'unidades', 'subtotal', 'descuentos', 'envio', 'total', 'cupon', 'reembolsado'],
    pedidos.map((p) => [
      p.numero,
      p.createdAt,
      p.pagadoEn,
      p.estado,
      p.estadoPago,
      p.metodoPago,
      p.canal,
      p.nombre,
      p.email,
      p.dni,
      p.modalidad,
      p.optica?.nombre ?? '',
      p.localidad,
      p.provincia,
      p.items.reduce((a, i) => a + i.cantidad, 0),
      p.subtotal.toString(),
      p.descuentos.toString(),
      p.envio.toString(),
      p.total.toString(),
      p.cuponCodigo ?? '',
      p.reembolsado.toString(),
    ]),
  );
}

export async function csvItems(periodo: Periodo): Promise<string> {
  const { desdeTs, hastaTs } = limitesPeriodo(periodo);
  const items = await prisma.pedidoItem.findMany({
    where: { pedido: { createdAt: { gte: desdeTs, lte: hastaTs } } },
    include: { pedido: { select: { numero: true, createdAt: true, estado: true, estadoPago: true } } },
    orderBy: [{ pedido: { createdAt: 'asc' } }, { id: 'asc' }],
  });
  return aCsv(
    ['pedido', 'creado', 'estado', 'estado_pago', 'sku', 'producto', 'color', 'linea', 'cantidad', 'precio_unitario', 'descuento', 'total', 'con_receta'],
    items.map((i) => [
      i.pedido.numero,
      i.pedido.createdAt,
      i.pedido.estado,
      i.pedido.estadoPago,
      i.sku,
      i.nombre,
      i.color,
      i.linea,
      i.cantidad,
      i.precioUnitario.toString(),
      i.descuento.toString(),
      i.total.toString(),
      i.conReceta ? 'si' : 'no',
    ]),
  );
}
