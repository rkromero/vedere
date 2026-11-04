// B2B 4: panel /optica/nivel. La óptica ve su nivel, puntaje, puntos por variable, la sugerencia para subir,
// beneficios y logros. Sólo puede cargar las fotos de su vitrina (logro Vitrina Vedere).
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import { guardarArchivo } from '../lib/archivos.js';
import { Errors } from '../lib/errors.js';
import { evaluarLogros, panelNivel } from '../lib/niveles.js';
import { parse } from '../lib/validate.js';

const MAX_FOTOS = 8;

const opticaNivelRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.requireOptica);

  app.get('/', async (request) => {
    const panel = await panelNivel(request.optica!.id);
    if (!panel) throw Errors.notFound('Óptica no encontrada');
    return panel;
  });

  app.post('/vitrina', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!request.isMultipart()) throw Errors.badRequest('Adjuntá una foto de la vitrina');
    const file = await request.file();
    if (!file) throw Errors.badRequest('Adjuntá una foto de la vitrina');
    if (!file.mimetype.startsWith('image/')) throw Errors.badRequest('La vitrina tiene que ser una foto (JPG, PNG o WEBP)');
    const o = await prisma.optica.findUniqueOrThrow({ where: { id: request.optica!.id }, select: { fotosVitrina: true } });
    if (o.fotosVitrina.length >= MAX_FOTOS) throw Errors.badRequest(`Podés cargar hasta ${MAX_FOTOS} fotos`);
    const guardado = await guardarArchivo(app.env, file, 'opticas-vitrinas', 'la foto');
    await prisma.optica.update({ where: { id: request.optica!.id }, data: { fotosVitrina: { push: guardado.url } } });
    const logros = await evaluarLogros(app.env, request.optica!.id);
    return reply.status(201).send({ url: guardado.url, logros });
  });

  app.delete('/vitrina', async (request) => {
    const { url } = parse(z.object({ url: z.string().min(1).max(500) }), request.body);
    const o = await prisma.optica.findUniqueOrThrow({ where: { id: request.optica!.id }, select: { fotosVitrina: true } });
    await prisma.optica.update({ where: { id: request.optica!.id }, data: { fotosVitrina: o.fotosVitrina.filter((f) => f !== url) } });
    return { ok: true };
  });
};

export default opticaNivelRoutes;
