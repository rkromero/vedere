// Subida de archivos de usuarios (foto o PDF): recetas del checkout y habilitaciones de ópticas.
// Se guardan tal cual (sin procesar) en R2 o en disco local con un nombre aleatorio.
import { randomUUID } from 'node:crypto';
import type { Env } from '../env.js';
import { Errors } from './errors.js';
import { putObject } from './storage.js';

export const ARCHIVO_TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] as const;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

export interface ArchivoMultipart {
  mimetype: string;
  filename: string;
  toBuffer: () => Promise<Buffer>;
  file: { truncated: boolean };
}

/** Lee un archivo multipart (foto o PDF) y lo guarda en R2 / disco en `folder/`. */
export async function guardarArchivo(env: Env, file: ArchivoMultipart, folder: string, etiqueta = 'el archivo') {
  if (!(ARCHIVO_TIPOS as readonly string[]).includes(file.mimetype)) {
    throw Errors.badRequest(`Formato no permitido: subí ${etiqueta} como foto (JPG, PNG, WebP, HEIC) o PDF`);
  }
  const body = await file.toBuffer();
  if (file.file.truncated || body.length > env.MAX_UPLOAD_MB * 1024 * 1024) {
    throw Errors.badRequest(`El archivo supera los ${env.MAX_UPLOAD_MB} MB`);
  }
  const ext = EXT_BY_TYPE[file.mimetype] ?? 'bin';
  const key = `${folder}/${randomUUID()}.${ext}`;
  const url = await putObject(env, { key, body, contentType: file.mimetype });
  return { url, nombre: file.filename.slice(0, 200), tamano: body.length, tipo: file.mimetype };
}
