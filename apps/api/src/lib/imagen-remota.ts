// Descarga de imágenes desde URLs externas (fotos que trae la búsqueda por código de barras) con
// protección SSRF: sólo http(s), sin IPs privadas / loopback / link-local, redirecciones revalidadas,
// timeout y tope de tamaño. Después se procesan igual que una subida (WebP en 3 tamaños).
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { Env } from '../env.js';
import { AppError } from './errors.js';
import { processAndStoreImage } from './storage.js';
import type { ProcessedImage } from './storage.js';

const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

/** true si la IP es privada, loopback, link-local, CGNAT, multicast o reservada. */
export function ipPrivada(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1') return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return ipPrivada(mapped[1]!);
    return /^(fc|fd|fe[89ab]|ff)/.test(x);
  }
  return true;
}

async function validarDestino(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError(400, 'BAD_REQUEST', 'Sólo se pueden importar imágenes http(s)');
  }
  if (url.username || url.password)
    throw new AppError(400, 'BAD_REQUEST', 'URL de imagen inválida');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const direcciones = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => []);
  if (direcciones.length === 0)
    throw new AppError(400, 'BAD_REQUEST', 'No se pudo resolver el servidor de la imagen');
  if (direcciones.some((d) => ipPrivada(d.address))) {
    throw new AppError(400, 'BAD_REQUEST', 'La URL de la imagen apunta a una red interna');
  }
}

/** Descarga la imagen (siguiendo hasta 3 redirecciones, cada una revalidada) y devuelve el buffer. */
export async function descargarImagen(env: Env, urlTexto: string): Promise<Buffer> {
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  let url: URL;
  try {
    url = new URL(urlTexto);
  } catch {
    throw new AppError(400, 'BAD_REQUEST', 'URL de imagen inválida');
  }

  for (let salto = 0; salto <= MAX_REDIRECTS; salto++) {
    await validarDestino(url);
    const res = await fetch(url, {
      redirect: 'manual',
      headers: {
        accept: 'image/*',
        'user-agent': 'Mozilla/5.0 (compatible; vedere-backoffice/1.0)',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const destino = res.headers.get('location');
      if (!destino) break;
      url = new URL(destino, url);
      continue;
    }
    if (!res.ok || !res.body)
      throw new AppError(400, 'BAD_REQUEST', `La imagen respondió ${res.status}`);

    const tipo = res.headers.get('content-type') ?? '';
    if (tipo && !/^image\/|application\/octet-stream|binary\/octet-stream/i.test(tipo)) {
      throw new AppError(400, 'BAD_REQUEST', 'La URL no es una imagen');
    }
    const largo = Number(res.headers.get('content-length') ?? 0);
    if (largo > maxBytes)
      throw new AppError(400, 'BAD_REQUEST', `La imagen supera ${env.MAX_UPLOAD_MB} MB`);

    const partes: Buffer[] = [];
    let total = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;
      if (total > maxBytes)
        throw new AppError(400, 'BAD_REQUEST', `La imagen supera ${env.MAX_UPLOAD_MB} MB`);
      partes.push(Buffer.from(chunk));
    }
    return Buffer.concat(partes);
  }
  throw new AppError(400, 'BAD_REQUEST', 'Demasiadas redirecciones');
}

export interface ResultadoImportacion {
  imagenes: Array<ProcessedImage & { origen: string }>;
  errores: Array<{ url: string; mensaje: string }>;
}

/** Importa varias URLs en paralelo; las que fallan se informan sin cortar el resto. */
export async function importarImagenes(
  env: Env,
  urls: string[],
  folder = 'productos',
): Promise<ResultadoImportacion> {
  const resultados = await Promise.allSettled(
    urls.map(async (u) => {
      const buffer = await descargarImagen(env, u);
      const img = await processAndStoreImage(env, { buffer, folder });
      return { ...img, origen: u };
    }),
  );
  const out: ResultadoImportacion = { imagenes: [], errores: [] };
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') out.imagenes.push(r.value);
    else
      out.errores.push({
        url: urls[i]!,
        mensaje: r.reason instanceof AppError ? r.reason.message : 'No se pudo descargar la imagen',
      });
  });
  return out;
}
