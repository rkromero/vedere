// Subida de imágenes (multipart) → WebP en 3 tamaños → R2 (o disco local en desarrollo).
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Errors } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';
import {
  ALLOWED_IMAGE_TYPES,
  presignUpload,
  processAndStoreImage,
  storageDriver,
} from '../../lib/storage.js';

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

const imagenesRoutes: FastifyPluginAsync = async (app) => {
  /** Estado del almacenamiento (para que el backoffice avise si está en modo local). */
  app.get('/imagenes/config', async () => ({
    driver: storageDriver(app.env),
    maxUploadMb: app.env.MAX_UPLOAD_MB,
    tiposPermitidos: ALLOWED_IMAGE_TYPES,
  }));

  /** multipart/form-data con campo `file` (y opcional `folder`). */
  app.post('/imagenes', async (request, reply) => {
    const file = await request.file();
    if (!file) throw Errors.badRequest('Enviá un archivo en el campo "file"');
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw Errors.badRequest(`Tipo de imagen no permitido: ${file.mimetype}`);
    }
    const folderField = file.fields.folder;
    const folder =
      folderField && 'value' in folderField && typeof folderField.value === 'string'
        ? folderField.value
        : 'productos';

    const buffer = await file.toBuffer();
    if (file.file.truncated) {
      throw Errors.badRequest(`La imagen supera el máximo de ${app.env.MAX_UPLOAD_MB} MB`);
    }

    const result = await processAndStoreImage(app.env, { buffer, folder });
    return reply.status(201).send({ ...result, nombreOriginal: file.filename });
  });

  /** URL prefirmada para subida directa a R2 (sin procesar). */
  app.post('/imagenes/presign', async (request) => {
    const body = parse(presignSchema, request.body);
    return presignUpload(app.env, body);
  });
};

export default imagenesRoutes;
