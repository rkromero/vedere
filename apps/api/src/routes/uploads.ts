// Subida de imágenes a R2 vía URL prefirmada. Sólo staff (ADMIN / OPERADOR).
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parse } from '../lib/validate.js';
import { ALLOWED_IMAGE_TYPES, presignImageUpload } from '../lib/storage.js';

const presignSchema = z.object({
  folder: z.string().trim().min(1).max(60).default('productos'),
  contentType: z.enum(ALLOWED_IMAGE_TYPES as [string, ...string[]], {
    error: 'Tipo de imagen no permitido',
  }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024, 'Máximo 10 MB')
    .optional(),
});

const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.requireRole('ADMIN', 'OPERADOR'));

  app.post('/presign', async (request) => {
    const body = parse(presignSchema, request.body);
    return presignImageUpload(app.env, body);
  });
};

export default uploadRoutes;
