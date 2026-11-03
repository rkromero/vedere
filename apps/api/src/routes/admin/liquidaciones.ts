// Liquidaciones mensuales de ópticas (staff): resumen general y detalle por óptica.
import type { FastifyPluginAsync } from 'fastify';
import { liquidacionGeneral, liquidacionOptica } from '../../lib/liquidacion.js';
import { parse } from '../../lib/validate.js';
import { liquidacionQuery } from '../../schemas/checkout.js';

const liquidacionesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(liquidacionQuery, request.query);
    if (q.opticaId) return liquidacionOptica(q.opticaId, q.mes);
    return liquidacionGeneral(q.mes);
  });
};

export default liquidacionesRoutes;
