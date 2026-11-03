// Almacenamiento de imágenes en Cloudflare R2 (API compatible S3).
// La API nunca recibe el archivo: entrega una URL prefirmada (PUT) y la URL pública que se guarda en la DB.
import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../env.js';
import { AppError } from './errors.js';

export interface StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

export function getStorageConfig(env: Env): StorageConfig | null {
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
  };
}

let client: S3Client | null = null;

function getClient(cfg: StorageConfig): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }
  return client;
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

export const ALLOWED_IMAGE_TYPES = Object.keys(EXT_BY_TYPE);

export interface PresignedUpload {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
}

/** Genera una URL prefirmada para subir una imagen directamente a R2. */
export async function presignImageUpload(
  env: Env,
  input: { folder: string; contentType: string; sizeBytes?: number },
): Promise<PresignedUpload> {
  const cfg = getStorageConfig(env);
  if (!cfg) {
    throw new AppError(
      503,
      'STORAGE_NOT_CONFIGURED',
      'El almacenamiento de imágenes no está configurado',
    );
  }
  const ext = EXT_BY_TYPE[input.contentType];
  if (!ext) {
    throw new AppError(400, 'BAD_REQUEST', 'Tipo de imagen no permitido');
  }

  const folder = input.folder.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'uploads';
  const key = `${folder}/${randomUUID()}.${ext}`;
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
