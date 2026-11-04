// Público: solicitud de alta al programa de ópticas socias (/opticas/sumate). Primero se sube la habilitación
// (foto o PDF → R2) y después se manda la solicitud con la URL devuelta.
import type { FastifyPluginAsync } from 'fastify';
import { guardarArchivo } from '../lib/archivos.js';
import { Errors } from '../lib/errors.js';
import { crearSolicitudOptica } from '../lib/solicitudes-optica.js';
import { parse } from '../lib/validate.js';
import { solicitudOpticaInput } from '../schemas/b2b.js';

const formRateLimit = { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } };

const programaOpticasRoutes: FastifyPluginAsync = async (app) => {
  app.post('/habilitacion', formRateLimit, async (request, reply) => {
    if (!request.isMultipart()) throw Errors.badRequest('Adjuntá la habilitación (foto o PDF)');
    const file = await request.file();
    if (!file) throw Errors.badRequest('Adjuntá la habilitación (foto o PDF)');
    const guardado = await guardarArchivo(app.env, file, 'opticas-habilitaciones', 'la habilitación');
    return reply.status(201).send(guardado);
  });

  app.post('/solicitudes', formRateLimit, async (request, reply) => {
    const body = parse(solicitudOpticaInput, request.body);
    if (body.web) return reply.status(201).send({ ok: true }); // honeypot
    const { aceptaTerminos: _a, web: _w, ...data } = body;
    const s = await crearSolicitudOptica(app.env, { ...data, ip: request.ip });
    return reply.status(201).send({ ok: true, id: s.id, email: s.email });
  });
};

export default programaOpticasRoutes;
