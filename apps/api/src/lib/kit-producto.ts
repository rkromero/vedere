// B2B 2: material para la vidriera y las redes de la óptica. Ficha técnica en PDF (sin precios
// mayoristas: es para mostrar al público) y un ZIP con las fotos en alta (JPG) + la ficha.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { zipSync } from 'fflate';
import type { Env } from '../env.js';
import { getR2Config } from './storage.js';
import type { ProductoMayorista } from './mayorista.js';

const LINEA: Record<string, string> = { SOL: 'Anteojos de sol', RECETADO: 'Recetados', MULTIFOCAL: 'Multifocales', ACCESORIO: 'Accesorios' };
const capital = (s: string | null | undefined) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : null);
const pesos = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

/**
 * Descarga una imagen del catálogo. Sólo acepta URLs del almacenamiento propio (R2 público o /uploads
 * de la API en modo local) para no convertir el endpoint en un proxy a cualquier host.
 */
export async function leerImagen(env: Env, url: string): Promise<Buffer | null> {
  try {
    const local = `${env.API_PUBLIC_URL.replace(/\/$/, '')}/uploads/`;
    if (url.startsWith(local)) {
      const rel = url.slice(local.length).split('?')[0]!;
      const base = path.resolve(env.UPLOADS_DIR);
      const file = path.resolve(base, rel);
      if (!file.startsWith(base + path.sep)) return null;
      return await readFile(file);
    }
    const r2 = getR2Config(env)?.publicUrl;
    if (!r2 || !url.startsWith(r2.replace(/\/$/, '') + '/')) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const aJpg = (buf: Buffer) => sharp(buf).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();

const slugArchivo = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'foto';

/** Ficha técnica en PDF (A4) con la foto principal, medidas, colores y precio sugerido al público. */
export async function fichaTecnicaPdf(env: Env, p: ProductoMayorista): Promise<Buffer> {
  const portadaUrl = p.variantes.flatMap((v) => v.imagenes)[0]?.url;
  const portada = portadaUrl ? await leerImagen(env, portadaUrl) : null;
  const portadaJpg = portada ? await aJpg(portada).catch(() => null) : null;

  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `${p.nombre} · Ficha técnica Vedere`, Author: 'Vedere' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#6b6b6b').text('VEDERE · FICHA TÉCNICA', { characterSpacing: 1.5 });
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(26).fillColor('#111111').text(p.nombre);
  const sub = [p.marca?.nombre, LINEA[p.linea] ?? p.linea, p.coleccion ? `Colección ${p.coleccion.nombre}` : null].filter(Boolean).join(' · ');
  doc.font('Helvetica').fontSize(12).fillColor('#444444').text(sub);
  doc.moveDown(1);

  if (portadaJpg) {
    const ancho = doc.page.width - 96;
    doc.image(portadaJpg, { fit: [ancho, 300], align: 'center' });
    doc.moveDown(1);
  }

  const fila = (k: string, v: string | null | undefined) => {
    if (!v) return;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111').text(`${k}: `, { continued: true });
    doc.font('Helvetica').fillColor('#333333').text(v);
  };
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#111111').text('Características');
  doc.moveDown(0.3);
  fila('Forma', capital(p.forma));
  fila('Material', capital(p.material));
  fila('Género', capital(p.genero));
  const medidas = [
    p.calibreMm ? `calibre ${p.calibreMm} mm` : null,
    p.puenteMm ? `puente ${p.puenteMm} mm` : null,
    p.varillaMm ? `varilla ${p.varillaMm} mm` : null,
  ].filter(Boolean);
  fila('Medidas', medidas.length ? medidas.join(' · ') : null);
  fila('Precio sugerido al público', pesos(Number(p.precio)));
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(14).fillColor('#111111').text('Colores disponibles');
  doc.moveDown(0.3);
  for (const v of p.variantes) {
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#333333')
      .text(`• ${v.colorArmazon}${v.colorLente ? ` / lente ${v.colorLente}` : ''}  (SKU ${v.sku})`);
  }
  if (p.descripcion) {
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#111111').text('Descripción');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11).fillColor('#333333').text(p.descripcion);
  }
  doc.moveDown(1.5);
  doc.font('Helvetica').fontSize(9).fillColor('#888888').text('Material para la vidriera y las redes de ópticas socias Vedere.');
  doc.end();
  return fin;
}

/** ZIP con las fotos grandes de cada color (JPG) y la ficha técnica en PDF. */
export async function kitProductoZip(env: Env, p: ProductoMayorista): Promise<Buffer> {
  const archivos: Record<string, Uint8Array> = {};
  archivos[`${slugArchivo(p.slug)}-ficha-tecnica.pdf`] = await fichaTecnicaPdf(env, p);
  for (const v of p.variantes) {
    let n = 0;
    for (const img of v.imagenes) {
      const buf = await leerImagen(env, img.url);
      if (!buf) continue;
      const jpg = await aJpg(buf).catch(() => null);
      if (!jpg) continue;
      n += 1;
      archivos[`fotos/${slugArchivo(`${p.slug}-${v.colorArmazon}`)}-${n}.jpg`] = jpg;
    }
  }
  // Las fotos ya vienen comprimidas: nivel 0 para no gastar CPU de más.
  return Buffer.from(zipSync(archivos, { level: 0 }));
}
