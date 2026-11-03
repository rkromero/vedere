// Subida de imágenes con driver R2: sharp → WebP en 3 tamaños → PutObject firmado (SigV4)
// contra un servidor S3-compatible. No hace falta una cuenta de Cloudflare: se levanta un
// servidor HTTP mínimo que implementa PUT de objetos y guarda lo recibido en memoria.
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  getR2Config,
  presignUpload,
  processAndStoreImage,
  storageDriver,
} from '../src/lib/storage.js';
import { testEnv } from './helpers.js';

interface StoredObject {
  bucket: string;
  key: string;
  contentType: string;
  cacheControl: string;
  authorization: string;
  body: Buffer;
}

/** Servidor S3-compatible mínimo (path-style: PUT /<bucket>/<key>). */
function fakeS3() {
  const objects: StoredObject[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      if (req.method !== 'PUT') {
        res.writeHead(405).end();
        return;
      }
      const [, bucket, ...rest] = (req.url ?? '').split('?')[0]!.split('/');
      objects.push({
        bucket: bucket ?? '',
        key: decodeURIComponent(rest.join('/')),
        contentType: String(req.headers['content-type'] ?? ''),
        cacheControl: String(req.headers['cache-control'] ?? ''),
        authorization: String(req.headers.authorization ?? ''),
        body: Buffer.concat(chunks),
      });
      res.writeHead(200, { ETag: '"fake"' }).end();
    });
  });
  return { server, objects };
}

async function imagenJpeg(width = 2000, height = 1200): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#F2B33D' } })
    .jpeg()
    .toBuffer();
}

describe('almacenamiento R2 (S3 compatible)', () => {
  let server: Server;
  let objects: StoredObject[];
  let endpoint: string;
  let r2Env: Record<string, string>;

  beforeAll(async () => {
    ({ server, objects } = fakeS3());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    r2Env = {
      STORAGE_DRIVER: 'auto',
      R2_ACCOUNT_ID: 'cuenta-test',
      R2_ACCESS_KEY_ID: 'AKIATEST',
      R2_SECRET_ACCESS_KEY: 'secreto-de-prueba',
      R2_BUCKET: 'vedere-media-test',
      R2_PUBLIC_URL: 'https://media.test.vedere/',
      R2_ENDPOINT: endpoint,
    };
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('con credenciales R2 el driver "auto" elige r2 y arma la configuración', () => {
    const env = testEnv(r2Env);
    expect(storageDriver(env)).toBe('r2');
    expect(getR2Config(env)).toMatchObject({
      bucket: 'vedere-media-test',
      publicUrl: 'https://media.test.vedere',
      endpoint,
    });
    // Sin endpoint explícito se usa el de la cuenta de Cloudflare.
    const sinEndpoint = testEnv({ ...r2Env, R2_ENDPOINT: '' });
    expect(getR2Config(sinEndpoint)?.endpoint).toBe('https://cuenta-test.r2.cloudflarestorage.com');
    // Sin credenciales, cae a local.
    expect(storageDriver(testEnv({ STORAGE_DRIVER: 'auto' }))).toBe('local');
  });

  it('procesa una imagen a WebP en 3 tamaños y la sube firmada al bucket', async () => {
    objects.length = 0;
    const env = testEnv(r2Env);
    const buffer = await imagenJpeg(2000, 1200);

    const r = await processAndStoreImage(env, { buffer, folder: 'productos' });

    expect(r.width).toBe(2000);
    expect(r.height).toBe(1200);
    expect(r.url).toBe(`https://media.test.vedere/${r.key}-1600.webp`);
    expect(r.urlMediana).toBe(`https://media.test.vedere/${r.key}-800.webp`);
    expect(r.urlMiniatura).toBe(`https://media.test.vedere/${r.key}-320.webp`);
    expect(r.key).toMatch(/^productos\/[0-9a-f-]{36}$/);

    expect(objects).toHaveLength(3);
    const porKey = Object.fromEntries(objects.map((o) => [o.key, o]));
    for (const [sufijo, ancho] of [
      ['-1600.webp', 1600],
      ['-800.webp', 800],
      ['-320.webp', 320],
    ] as const) {
      const obj = porKey[`${r.key}${sufijo}`];
      expect(obj, `objeto ${sufijo}`).toBeDefined();
      expect(obj!.bucket).toBe('vedere-media-test');
      expect(obj!.contentType).toBe('image/webp');
      expect(obj!.cacheControl).toContain('immutable');
      // Firma AWS SigV4 con la access key configurada.
      expect(obj!.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIATEST\//);
      const meta = await sharp(obj!.body).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(ancho);
      expect(meta.height).toBe(Math.round((ancho * 1200) / 2000));
    }
  });

  it('no agranda imágenes chicas y rechaza archivos que no son imagen', async () => {
    objects.length = 0;
    const env = testEnv(r2Env);
    const r = await processAndStoreImage(env, {
      buffer: await imagenJpeg(500, 500),
      folder: 'marcas',
    });
    const anchos = await Promise.all(
      objects.map(async (o) => (await sharp(o.body).metadata()).width),
    );
    expect(anchos.sort((a, b) => a! - b!)).toEqual([320, 500, 500]);
    expect(r.key.startsWith('marcas/')).toBe(true);

    await expect(
      processAndStoreImage(env, { buffer: Buffer.from('esto no es una imagen'), folder: 'x' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('genera URLs prefirmadas para subida directa y falla claro sin R2', async () => {
    const env = testEnv(r2Env);
    const p = await presignUpload(env, {
      folder: 'banners',
      contentType: 'image/png',
      sizeBytes: 1234,
    });
    expect(p.key).toMatch(/^banners\/[0-9a-f-]{36}\.png$/);
    expect(p.publicUrl).toBe(`https://media.test.vedere/${p.key}`);
    expect(p.uploadUrl.startsWith(`${endpoint}/vedere-media-test/banners/`)).toBe(true);
    expect(p.uploadUrl).toContain('X-Amz-Signature=');
    expect(p.uploadUrl).toContain('X-Amz-Credential=AKIATEST');

    await expect(
      presignUpload(testEnv({ STORAGE_DRIVER: 'local' }), {
        folder: 'x',
        contentType: 'image/png',
      }),
    ).rejects.toMatchObject({ statusCode: 503, code: 'STORAGE_NOT_CONFIGURED' });
  });

  describe.skipIf(!process.env.TEST_DATABASE_URL)('POST /admin/imagenes con driver r2', () => {
    let app: FastifyInstance;
    let staffCookie: Record<string, string>;

    beforeAll(async () => {
      const { buildApp } = await import('../src/app.js');
      app = await buildApp({
        env: testEnv({ ...r2Env, DATABASE_URL: process.env.TEST_DATABASE_URL! }),
        logger: false,
      });
      await app.ready();
      staffCookie = {
        vedere_access: app.jwt.sign({
          sub: 'operador-r2',
          email: 'op@test.vedere',
          rol: 'OPERADOR',
        }),
      };
    });

    afterAll(async () => {
      await app.close();
    });

    function multipart(
      fields: Record<string, string>,
      file: { name: string; type: string; data: Buffer },
    ) {
      const boundary = '----vedere-test-boundary';
      const parts: Buffer[] = [];
      for (const [k, v] of Object.entries(fields)) {
        parts.push(
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
          ),
        );
      }
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`,
        ),
        file.data,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      );
      return {
        body: Buffer.concat(parts),
        contentType: `multipart/form-data; boundary=${boundary}`,
      };
    }

    it('informa driver r2 y sube la imagen al bucket devolviendo las 3 URLs', async () => {
      objects.length = 0;
      const cfg = await app.inject({
        method: 'GET',
        url: '/admin/imagenes/config',
        cookies: staffCookie,
      });
      expect(cfg.json().driver).toBe('r2');

      const { body, contentType } = multipart(
        { folder: 'productos' },
        { name: 'frente.jpg', type: 'image/jpeg', data: await imagenJpeg(1800, 1800) },
      );
      const res = await app.inject({
        method: 'POST',
        url: '/admin/imagenes',
        headers: { 'content-type': contentType },
        payload: body,
        cookies: staffCookie,
      });
      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.nombreOriginal).toBe('frente.jpg');
      expect(json.url).toMatch(/^https:\/\/media\.test\.vedere\/productos\/.+-1600\.webp$/);
      expect(json.urlMediana).toMatch(/-800\.webp$/);
      expect(json.urlMiniatura).toMatch(/-320\.webp$/);
      expect(objects.map((o) => o.key).sort()).toEqual(
        [`${json.key}-1600.webp`, `${json.key}-320.webp`, `${json.key}-800.webp`].sort(),
      );

      // Tipo no permitido y sin sesión.
      const malo = multipart({}, { name: 'a.txt', type: 'text/plain', data: Buffer.from('hola') });
      const r400 = await app.inject({
        method: 'POST',
        url: '/admin/imagenes',
        headers: { 'content-type': malo.contentType },
        payload: malo.body,
        cookies: staffCookie,
      });
      expect(r400.statusCode).toBe(400);
      const r401 = await app.inject({
        method: 'POST',
        url: '/admin/imagenes',
        headers: { 'content-type': contentType },
        payload: body,
      });
      expect(r401.statusCode).toBe(401);
    });
  });
});
