import type { ZodType } from 'zod';

/** Parsea y tipa `data` con un esquema Zod; lanza ZodError (lo maneja errorHandler → 400). */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  return schema.parse(data);
}
