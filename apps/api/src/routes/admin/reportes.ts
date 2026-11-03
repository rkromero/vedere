// Reportes del backoffice (prompt 6): ventas por período (hoy/semana/mes), ticket promedio, conversión,
// pedidos por estado, ventas por línea/óptica/colección/código de creador, más vendidos y exportación CSV.
import type { FastifyPluginAsync } from 'fastify';
import { Errors } from '../../lib/errors.js';
import { csvItems, csvPedidos, generarReporte, periodoDefault } from '../../lib/reportes.js';
import { parse } from '../../lib/validate.js';
import { reportesCsvQuery, reportesQuery } from '../../schemas/sitio.js';

function periodoDe(q: { desde?: string; hasta?: string }) {
  const def = periodoDefault();
  const periodo = { desde: q.desde ?? def.desde, hasta: q.hasta ?? def.hasta };
  if (periodo.desde > periodo.hasta) throw Errors.badRequest('La fecha "desde" tiene que ser anterior a "hasta"');
  return periodo;
}

const reportesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(reportesQuery, request.query);
    return generarReporte(periodoDe(q));
  });

  app.get('/csv', async (request, reply) => {
    const q = parse(reportesCsvQuery, request.query);
    const periodo = periodoDe(q);
    const csv = q.tipo === 'items' ? await csvItems(periodo) : await csvPedidos(periodo);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="vedere-${q.tipo}-${periodo.desde}-${periodo.hasta}.csv"`)
      .send(csv);
  });
};

export default reportesRoutes;
