// Liquidaciones mensuales de ópticas (staff): resumen general y detalle por óptica. B2B 3: cerrar un mes
// (sólo ADMIN) acredita la comisión de los pedidos web entregados en la cuenta corriente de cada óptica.
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import { cerrarLiquidacion } from '../../lib/cuenta-corriente.js';
import { liquidacionGeneral, liquidacionOptica } from '../../lib/liquidacion.js';
import { dec } from '../../lib/serialize.js';
import { parse } from '../../lib/validate.js';
import { liquidacionQuery } from '../../schemas/checkout.js';
import { cerrarLiquidacionInput } from '../../schemas/mayorista.js';
import { actorDeRequest } from './mayorista.js';

export async function cierreDe(mes: string) {
  const c = await prisma.liquidacionCierre.findUnique({ where: { mes } });
  return c ? { mes: c.mes, cerradoEn: c.cerradoEn, total: dec(c.total)!, cantidadOpticas: c.cantidadOpticas } : null;
}

const liquidacionesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(liquidacionQuery, request.query);
    const liq = q.opticaId ? await liquidacionOptica(q.opticaId, q.mes) : await liquidacionGeneral(q.mes);
    return { ...liq, cierre: await cierreDe(liq.mes) };
  });

  app.post('/cerrar', { onRequest: app.requireRole('ADMIN') }, async (request) => {
    const body = parse(cerrarLiquidacionInput, request.body);
    return cerrarLiquidacion(body.mes, actorDeRequest(request));
  });
};

export default liquidacionesRoutes;
