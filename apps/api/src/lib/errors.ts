import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { capturarError } from './sentry.js';
import { Prisma } from '@vedere/db';
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
  conflict: (msg: string, details?: unknown) => new AppError(409, 'CONFLICT', msg, details),
  badRequest: (msg: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', msg, details),
};

const UNIQUE_FIELD_LABELS: Record<string, string> = {
  sku: 'El SKU ya existe en otra variante',
  slug: 'Ya existe un registro con ese slug',
  email: 'Ya existe un usuario con ese email',
  token_hash: 'Token duplicado',
};

function prismaKnownError(error: Prisma.PrismaClientKnownRequestError): AppError | null {
  if (error.code === 'P2002') {
    const target = (error.meta?.target as string[] | string | undefined) ?? [];
    const fields = Array.isArray(target) ? target : [target];
    const field = fields[0] ?? 'campo';
    const message =
      UNIQUE_FIELD_LABELS[field] ?? `Ya existe un registro con el mismo valor en "${field}"`;
    return new AppError(409, 'DUPLICATE', message, { fields });
  }
  if (error.code === 'P2025') {
    return new AppError(404, 'NOT_FOUND', 'Registro no encontrado');
  }
  if (error.code === 'P2003') {
    return new AppError(
      400,
      'BAD_REQUEST',
      'Referencia inválida: el registro relacionado no existe',
    );
  }
  return null;
}

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

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = prismaKnownError(error);
    if (mapped) {
      return reply.status(mapped.statusCode).send({
        error: { code: mapped.code, message: mapped.message, details: mapped.details },
      });
    }
  }

  const statusCode =
    'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;

  if (statusCode >= 500) {
    request.log.error({ err: error }, 'Error no controlado');
    capturarError(error, { method: request.method, url: request.url, requestId: request.id });
    return reply.status(statusCode).send({
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado' },
    });
  }

  // Errores 4xx generados por Fastify o plugins (rate limit, body parser, multipart, etc.).
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'REQUEST_ERROR';
  return reply.status(statusCode).send({ error: { code, message: error.message } });
}
