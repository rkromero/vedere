// Almacenamiento de imágenes: Cloudflare R2 (S3 compatible) o disco local como fallback de desarrollo.
// Las imágenes se procesan con sharp a WebP en 3 tamaños antes de guardarse.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import type { Metadata } from 'sharp';
import type { Env } from '../env.js';
import { AppError } from './errors.js';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
  /** Endpoint S3. Por defecto el de Cloudflare R2 de la cuenta. */
  endpoint: string;
}

export function getR2Config(env: Env): R2Config | null {
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET ||
    !env.R2_PUBLIC_URL
  ) {
    return null;
  }
  return {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    publicUrl: env.R2_PUBLIC_URL.replace(/\/$/, ''),
    endpoint: (env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`).replace(
      /\/$/,
      '',
    ),
  };
}

export type StorageDriver = 'r2' | 'local';

export function storageDriver(env: Env): StorageDriver {
  if (env.STORAGE_DRIVER === 'r2') return 'r2';
  if (env.STORAGE_DRIVER === 'local') return 'local';
  return getR2Config(env) ? 'r2' : 'local';
}

let client: { key: string; s3: S3Client } | null = null;

function getClient(cfg: R2Config): S3Client {
  const key = `${cfg.endpoint}|${cfg.bucket}|${cfg.accessKeyId}`;
  if (!client || client.key !== key) {
    client = {
      key,
      s3: new S3Client({
        region: 'auto',
        endpoint: cfg.endpoint,
        // Con un endpoint alternativo (MinIO, tests) el bucket va en el path, no como subdominio.
        forcePathStyle: !cfg.endpoint.endsWith('.r2.cloudflarestorage.com'),
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      }),
    };
  }
  return client.s3;
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

export const ALLOWED_IMAGE_TYPES = Object.keys(EXT_BY_TYPE);

function cleanFolder(folder: string): string {
  return folder.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'uploads';
}

/** Guarda un buffer y devuelve su URL pública. */
export async function putObject(
  env: Env,
  input: { key: string; body: Buffer; contentType: string },
): Promise<string> {
  const driver = storageDriver(env);
  if (driver === 'r2') {
    const cfg = getR2Config(env);
    if (!cfg) throw new AppError(503, 'STORAGE_NOT_CONFIGURED', 'R2 no está configurado');
    await getClient(cfg).send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${cfg.publicUrl}/${input.key}`;
  }

  const filePath = path.join(env.UPLOADS_DIR, input.key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, input.body);
  return `${env.API_PUBLIC_URL.replace(/\/$/, '')}/uploads/${input.key}`;
}

export const IMAGE_SIZES = {
  miniatura: 320,
  mediana: 800,
  grande: 1600,
} as const;

export interface ProcessedImage {
  key: string;
  url: string;
  urlMediana: string;
  urlMiniatura: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Procesa una imagen: la convierte a WebP en 3 tamaños (320 / 800 / 1600 px de ancho máx.)
 * y la sube al almacenamiento. Devuelve las 3 URLs.
 */
export async function processAndStoreImage(
  env: Env,
  input: { buffer: Buffer; folder?: string },
): Promise<ProcessedImage> {
  const folder = cleanFolder(input.folder ?? 'productos');
  const id = randomUUID();

  let meta: Metadata;
  try {
    meta = await sharp(input.buffer).metadata();
  } catch {
    throw new AppError(400, 'BAD_REQUEST', 'El archivo no es una imagen válida');
  }
  if (!meta.width || !meta.height) {
    throw new AppError(400, 'BAD_REQUEST', 'No se pudo leer el tamaño de la imagen');
  }

  const make = (width: number) =>
    sharp(input.buffer)
      .rotate()
      .resize({ width, withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: 82 })
      .toBuffer();

  const [grande, mediana, miniatura] = await Promise.all([
    make(IMAGE_SIZES.grande),
    make(IMAGE_SIZES.mediana),
    make(IMAGE_SIZES.miniatura),
  ]);

  const base = `${folder}/${id}`;
  const [url, urlMediana, urlMiniatura] = await Promise.all([
    putObject(env, { key: `${base}-1600.webp`, body: grande, contentType: 'image/webp' }),
    putObject(env, { key: `${base}-800.webp`, body: mediana, contentType: 'image/webp' }),
    putObject(env, { key: `${base}-320.webp`, body: miniatura, contentType: 'image/webp' }),
  ]);

  return {
    key: base,
    url,
    urlMediana,
    urlMiniatura,
    width: meta.width,
    height: meta.height,
    bytes: grande.byteLength,
  };
}

export interface PresignedUpload {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
}

/** URL prefirmada para subir un archivo directo a R2 (sin procesar). Sólo con driver r2. */
export async function presignUpload(
  env: Env,
  input: { folder: string; contentType: string; sizeBytes?: number },
): Promise<PresignedUpload> {
  const cfg = getR2Config(env);
  if (!cfg) {
    throw new AppError(
      503,
      'STORAGE_NOT_CONFIGURED',
      'La subida directa requiere R2 configurado; usá POST /admin/imagenes',
    );
  }
  const ext = EXT_BY_TYPE[input.contentType];
  if (!ext) throw new AppError(400, 'BAD_REQUEST', 'Tipo de imagen no permitido');

  const key = `${cleanFolder(input.folder)}/${randomUUID()}.${ext}`;
  const expiresIn = 300;
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
  });
  const uploadUrl = await getSignedUrl(getClient(cfg), command, { expiresIn });
  return { key, uploadUrl, publicUrl: `${cfg.publicUrl}/${key}`, expiresIn };
}
