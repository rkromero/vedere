// B2B 4: niveles de las ópticas en el backoffice. Configuración (cortes, rangos, pesos, beneficios, logros),
// recálculo (todas o una), nivel manual con motivo y vencimiento, y reporte de ópticas por nivel con su evolución.
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import type { NivelOptica } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import {
  asignarNivelManual,
  CONFIG_NIVELES_DEFAULT,
  condicionesDe,
  configNivelesSchema,
  getConfigNiveles,
  guardarConfigNiveles,
  LOGRO_INFO,
  manualVigente,
  mesLocal,
  NIVEL_INFO,
  NIVELES,
  panelNivel,
  recalcularNivel,
  recalcularTodas,
  sumarMeses,
} from '../../lib/niveles.js';
import { parse } from '../../lib/validate.js';

const nivelManualInput = z.object({
  nivel: z.enum(['VETRO', 'CRISTALLO', 'PRISMA', 'ZAFIRO'], { error: 'Elegí un nivel' }),
  motivo: z.string({ error: 'Contá el motivo' }).trim().min(5, 'Contá el motivo (5 caracteres o más)').max(300),
  /** AAAA-MM-DD (fin del día, hora de Argentina) o null = sin vencimiento. */
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .nullable()
    .optional(),
});

const nivelesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/config', async () => ({ config: await getConfigNiveles(), defaults: CONFIG_NIVELES_DEFAULT, niveles: NIVEL_INFO, logros: LOGRO_INFO }));

  app.put('/config', { onRequest: app.requireRole('ADMIN') }, async (request) => {
    const cfg = parse(configNivelesSchema, request.body);
    return { config: await guardarConfigNiveles(cfg) };
  });

  /** Ópticas por nivel, evolución de los últimos 12 meses y listado con puntaje y tendencia. */
  app.get('/reporte', async () => {
    const ahora = new Date();
    const cfg = await getConfigNiveles();
    const mes = mesLocal(ahora);
    const desde = sumarMeses(mes, -11);
    const [opticas, historial] = await Promise.all([
      prisma.optica.findMany({
        where: { activa: true },
        orderBy: [{ puntaje: { sort: 'desc', nulls: 'last' } }, { nombre: 'asc' }],
        select: {
          id: true,
          nombre: true,
          localidad: true,
          nivel: true,
          puntaje: true,
          nivelDesde: true,
          nivelCalculadoEn: true,
          nivelManual: true,
          nivelManualHasta: true,
          nivelManualMotivo: true,
          beneficioProvisorio: true,
          beneficioProvisorioHasta: true,
          bajaPendienteDesde: true,
          descuentoPct: true,
          cuentaCorriente: { select: { limiteCredito: true, plazoPagoDias: true } },
          historialNiveles: { orderBy: { mes: 'desc' }, take: 2, select: { mes: true, puntaje: true, nivel: true } },
          _count: { select: { logros: true } },
        },
      }),
      prisma.historialNivel.groupBy({ by: ['mes', 'nivel'], where: { mes: { gte: desde } }, _count: { _all: true } }),
    ]);
    const porNivel = Object.fromEntries(NIVELES.map((n) => [n, 0])) as Record<NivelOptica, number>;
    const filas = opticas.map((o) => {
      const cond = condicionesDe(o, o.cuentaCorriente, cfg, ahora);
      porNivel[cond.nivel]++;
      const [ultimo, anterior] = o.historialNiveles;
      return {
        id: o.id,
        nombre: o.nombre,
        localidad: o.localidad,
        nivel: cond.nivel,
        nivelAutomatico: o.nivel,
        nivelBeneficios: cond.nivelBeneficios,
        puntaje: o.puntaje,
        tendencia: ultimo && anterior ? ultimo.puntaje - anterior.puntaje : null,
        nivelDesde: o.nivelDesde,
        nivelCalculadoEn: o.nivelCalculadoEn,
        manual: manualVigente(o, ahora) ? { nivel: o.nivelManual, hasta: o.nivelManualHasta, motivo: o.nivelManualMotivo } : null,
        provisorio: o.beneficioProvisorio && o.beneficioProvisorioHasta && o.beneficioProvisorioHasta > ahora ? { nivel: o.beneficioProvisorio, hasta: o.beneficioProvisorioHasta } : null,
        enGracia: !!o.bajaPendienteDesde,
        logros: o._count.logros,
        descuentoPct: cond.descuentoPct,
        limiteCredito: cond.limiteCredito,
        plazoPagoDias: cond.plazoPagoDias,
      };
    });
    const meses: string[] = [];
    for (let i = 11; i >= 0; i--) meses.push(sumarMeses(mes, -i));
    const evolucion = meses.map((m) => {
      const fila = Object.fromEntries(NIVELES.map((n) => [n, 0])) as Record<NivelOptica, number>;
      for (const h of historial) if (h.mes === m) fila[h.nivel] = h._count._all;
      return { mes: m, ...fila, total: NIVELES.reduce((a, n) => a + fila[n], 0) };
    });
    return { mes, porNivel, evolucion, opticas: filas, niveles: NIVEL_INFO };
  });

  app.post('/recalcular', async () => {
    const resultados = await recalcularTodas(app.env);
    return { recalculadas: resultados.length, cambios: resultados.filter((r) => r.cambio), resultados };
  });

  app.get<{ Params: { id: string } }>('/opticas/:id', async (request) => {
    const panel = await panelNivel(request.params.id);
    if (!panel) throw Errors.notFound('Óptica no encontrada');
    return panel;
  });

  app.post<{ Params: { id: string } }>('/opticas/:id/recalcular', async (request) => {
    const r = await recalcularNivel(app.env, request.params.id);
    if (!r) throw Errors.notFound('Óptica no encontrada');
    return r;
  });

  app.put<{ Params: { id: string } }>('/opticas/:id/manual', { onRequest: app.requireRole('ADMIN') }, async (request) => {
    const body = parse(nivelManualInput, request.body);
    const hasta = body.hasta ? new Date(`${body.hasta}T23:59:59-03:00`) : null;
    if (hasta && hasta <= new Date()) throw Errors.badRequest('El vencimiento tiene que ser una fecha futura', [{ path: 'hasta', message: 'Elegí una fecha futura' }]);
    const o = await asignarNivelManual(app.env, request.params.id, { nivel: body.nivel, motivo: body.motivo, hasta }, { id: request.user.sub });
    if (!o) throw Errors.notFound('Óptica no encontrada');
    return panelNivel(request.params.id);
  });

  app.delete<{ Params: { id: string } }>('/opticas/:id/manual', { onRequest: app.requireRole('ADMIN') }, async (request) => {
    const o = await asignarNivelManual(app.env, request.params.id, null, { id: request.user.sub });
    if (!o) throw Errors.notFound('Óptica no encontrada');
    return panelNivel(request.params.id);
  });
};

export default nivelesRoutes;
