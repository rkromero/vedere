import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

/** Error de dominio con código HTTP y código de aplicación estable para el front. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  unauthorized: (msg = 'No autenticado') => new AppError(401, 'UNAUTHORIZED', msg),
  forbidden: (msg = 'No tenés permisos para esta acción') => new AppError(403, 'FORBIDDEN', msg),
  notFound: (msg = 'Recurso no encontrado') => new AppError(404, 'NOT_FOUND', msg),
  conflict: (msg: string) => new AppError(409, 'CONFLICT', msg),
  badRequest: (msg: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', msg, details),
};

export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message, details: error.details },
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }

  const statusCode =
    'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;

  if (statusCode >= 500) {
    request.log.error({ err: error }, 'Error no controlado');
    return reply.status(statusCode).send({
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado' },
    });
  }

  // Errores 4xx generados por Fastify o plugins (rate limit, body parser, etc.).
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'REQUEST_ERROR';
  return reply.status(statusCode).send({ error: { code, message: error.message } });
}
