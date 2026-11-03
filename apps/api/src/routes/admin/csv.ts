// Exportación / importación de productos por CSV (una fila por variante).
import type { FastifyPluginAsync } from 'fastify';
import { parse as parseCsv } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { productoInclude } from '../../lib/serialize.js';
import { dec } from '../../lib/serialize.js';
import { slugify } from '../../lib/slug.js';
import {
  ESTADOS,
  FORMAS,
  GENEROS,
  LINEAS,
  MATERIALES,
  TIPOS_IMAGEN,
} from '../../schemas/catalogo.js';

export const CSV_COLUMNS = [
  'producto_slug',
  'nombre',
  'descripcion',
  'marca_slug',
  'categorias',
  'coleccion_slug',
  'linea',
  'material',
  'forma',
  'genero',
  'calibre_mm',
  'puente_mm',
  'varilla_mm',
  'precio',
  'precio_lista',
  'permite_receta',
  'destacado',
  'edicion_limitada',
  'estado',
  'seo_title',
  'seo_description',
  'sku',
  'color_armazon',
  'color_armazon_hex',
  'color_lente',
  'color_lente_hex',
  'stock',
  'stock_minimo',
  'variante_activa',
  'variante_orden',
  'imagenes',
] as const;

const bool = (v: boolean) => (v ? 'si' : 'no');
const num = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

/** Imágenes: "FRENTE:https://.../a.webp|PERFIL:https://.../b.webp" (sólo la URL grande). */
function imagenesToCsv(
  imgs: Array<{
    tipo: string;
    url: string;
    urlMediana: string | null;
    urlMiniatura: string | null;
  }>,
) {
  return imgs
    .map((i) => [i.tipo, i.url, i.urlMediana ?? '', i.urlMiniatura ?? ''].join('::'))
    .join('|');
}

export async function exportProductosCsv(): Promise<string> {
  const productos = await prisma.producto.findMany({
    include: productoInclude,
    orderBy: { nombre: 'asc' },
  });
  const rows: Array<Record<string, string>> = [];
  for (const p of productos) {
    const base: Record<string, string> = {
      producto_slug: p.slug,
      nombre: p.nombre,
      descripcion: p.descripcion,
      marca_slug: p.marca?.slug ?? '',
      categorias: p.categorias.map((c) => c.slug).join('|'),
      coleccion_slug: p.coleccion?.slug ?? '',
      linea: p.linea,
      material: p.material ?? '',
      forma: p.forma ?? '',
      genero: p.genero,
      calibre_mm: num(p.calibreMm),
      puente_mm: num(p.puenteMm),
      varilla_mm: num(p.varillaMm),
      precio: num(dec(p.precio)),
      precio_lista: num(dec(p.precioLista)),
      permite_receta: bool(p.permiteReceta),
      destacado: bool(p.destacado),
      edicion_limitada: bool(p.edicionLimitada),
      estado: p.estado,
      seo_title: p.seoTitle ?? '',
      seo_description: p.seoDescription ?? '',
    };
    if (p.variantes.length === 0) {
      rows.push({
        ...base,
        sku: '',
        color_armazon: '',
        color_armazon_hex: '',
        color_lente: '',
        color_lente_hex: '',
        stock: '',
        stock_minimo: '',
        variante_activa: '',
        variante_orden: '',
        imagenes: '',
      });
      continue;
    }
    for (const v of p.variantes) {
      rows.push({
        ...base,
        sku: v.sku,
        color_armazon: v.colorArmazon,
        color_armazon_hex: v.colorArmazonHex ?? '',
        color_lente: v.colorLente ?? '',
        color_lente_hex: v.colorLenteHex ?? '',
        stock: String(v.stock),
        stock_minimo: String(v.stockMinimo),
        variante_activa: bool(v.activa),
        variante_orden: String(v.orden),
        imagenes: imagenesToCsv(v.imagenes),
      });
    }
  }
  return stringify(rows, { header: true, columns: [...CSV_COLUMNS], bom: true });
}

// ---------- Importación ----------
const siNo = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => ['si', 'sí', 'true', '1', 'yes'].includes(v));
const optEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => (v === '' ? null : v))
    .pipe(z.enum(values).nullable());
const optInt = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v)))
  .pipe(z.number().int().nullable());
const optNum = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v.replace(',', '.'))))
  .pipe(z.number().nullable());
const optStr = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v));

const rowSchema = z.object({
  producto_slug: z.string().trim().min(1, 'producto_slug es obligatorio'),
  nombre: z.string().trim().min(2, 'nombre es obligatorio'),
  descripcion: z.string().default(''),
  marca_slug: optStr,
  categorias: z.string().default(''),
  coleccion_slug: optStr,
  linea: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(LINEAS, { error: 'linea inválida' })),
  material: optEnum(MATERIALES),
  forma: optEnum(FORMAS),
  genero: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v || 'UNISEX')
    .pipe(z.enum(GENEROS)),
  calibre_mm: optInt,
  puente_mm: optInt,
  varilla_mm: optInt,
  precio: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(',', '.')))
    .pipe(z.number().nonnegative('precio inválido')),
  precio_lista: optNum,
  permite_receta: z.string().default('no').pipe(siNo),
  destacado: z.string().default('no').pipe(siNo),
  edicion_limitada: z.string().default('no').pipe(siNo),
  estado: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v || 'BORRADOR')
    .pipe(z.enum(ESTADOS)),
  seo_title: optStr,
  seo_description: optStr,
  sku: optStr,
  color_armazon: optStr,
  color_armazon_hex: optStr,
  color_lente: optStr,
  color_lente_hex: optStr,
  stock: optInt,
  stock_minimo: optInt,
  variante_activa: z.string().default('si').pipe(siNo),
  variante_orden: optInt,
  imagenes: z.string().default(''),
});

type Row = z.infer<typeof rowSchema>;

function parseImagenes(raw: string) {
  if (!raw.trim()) return [];
  return raw
    .split('|')
    .map((chunk, i) => {
      const [tipoRaw, url, urlMediana, urlMiniatura] = chunk.split('::');
      const tipo = (tipoRaw ?? '').trim().toUpperCase();
      return {
        tipo: (TIPOS_IMAGEN as readonly string[]).includes(tipo)
          ? (tipo as (typeof TIPOS_IMAGEN)[number])
          : 'OTRA',
        url: (url ?? '').trim(),
        urlMediana: urlMediana?.trim() || null,
        urlMiniatura: urlMiniatura?.trim() || null,
        orden: i,
      };
    })
    .filter((i) => i.url);
}

export interface ImportResult {
  productosCreados: number;
  productosActualizados: number;
  variantesCreadas: number;
  variantesActualizadas: number;
  filas: number;
}

export async function importProductosCsv(csv: string, userId: string): Promise<ImportResult> {
  let records: Record<string, string>[];
  try {
    records = parseCsv(csv, { columns: true, skip_empty_lines: true, bom: true, trim: true });
  } catch (err) {
    throw Errors.badRequest(
      `CSV inválido: ${err instanceof Error ? err.message : 'error de formato'}`,
    );
  }
  if (records.length === 0) throw Errors.badRequest('El CSV no tiene filas');

  const errores: Array<{ fila: number; mensaje: string }> = [];
  const rows: Array<Row & { fila: number }> = [];
  records.forEach((rec, i) => {
    const r = rowSchema.safeParse(rec);
    if (!r.success) {
      errores.push({
        fila: i + 2,
        mensaje: r.error.issues.map((is) => `${is.path.join('.')}: ${is.message}`).join('; '),
      });
    } else {
      rows.push({ ...r.data, fila: i + 2 });
    }
  });

  // SKUs repetidos dentro del archivo
  const skus = new Map<string, number>();
  for (const r of rows) {
    if (!r.sku) continue;
    const sku = r.sku.toUpperCase();
    if (skus.has(sku))
      errores.push({ fila: r.fila, mensaje: `SKU ${sku} repetido (ver fila ${skus.get(sku)})` });
    else skus.set(sku, r.fila);
  }
  if (errores.length) {
    throw Errors.badRequest('El CSV tiene errores; no se importó nada', { errores });
  }

  // Resolver referencias por slug
  const [marcas, categorias, colecciones] = await Promise.all([
    prisma.marca.findMany({ select: { id: true, slug: true } }),
    prisma.categoria.findMany({ select: { id: true, slug: true } }),
    prisma.coleccion.findMany({ select: { id: true, slug: true } }),
  ]);
  const marcaBySlug = new Map(marcas.map((m) => [m.slug, m.id]));
  const catBySlug = new Map(categorias.map((c) => [c.slug, c.id]));
  const colBySlug = new Map(colecciones.map((c) => [c.slug, c.id]));

  for (const r of rows) {
    if (r.marca_slug && !marcaBySlug.has(r.marca_slug))
      errores.push({ fila: r.fila, mensaje: `marca_slug "${r.marca_slug}" no existe` });
    if (r.coleccion_slug && !colBySlug.has(r.coleccion_slug))
      errores.push({ fila: r.fila, mensaje: `coleccion_slug "${r.coleccion_slug}" no existe` });
    for (const cs of r.categorias
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (!catBySlug.has(cs))
        errores.push({ fila: r.fila, mensaje: `categoría "${cs}" no existe` });
    }
  }
  if (errores.length) {
    throw Errors.badRequest('El CSV referencia marcas, categorías o colecciones inexistentes', {
      errores,
    });
  }

  // Agrupar por producto
  const grupos = new Map<string, Array<Row & { fila: number }>>();
  for (const r of rows) {
    const slug = slugify(r.producto_slug);
    const list = grupos.get(slug) ?? [];
    list.push(r);
    grupos.set(slug, list);
  }

  const result: ImportResult = {
    productosCreados: 0,
    productosActualizados: 0,
    variantesCreadas: 0,
    variantesActualizadas: 0,
    filas: rows.length,
  };

  await prisma.$transaction(
    async (tx) => {
      for (const [slug, filas] of grupos) {
        const first = filas[0]!;
        const categoriaIds = first.categorias
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => catBySlug.get(s)!);

        const data: Prisma.ProductoUncheckedCreateInput = {
          nombre: first.nombre,
          slug,
          descripcion: first.descripcion,
          marcaId: first.marca_slug ? marcaBySlug.get(first.marca_slug)! : null,
          coleccionId: first.coleccion_slug ? colBySlug.get(first.coleccion_slug)! : null,
          linea: first.linea,
          material: first.material,
          forma: first.forma,
          genero: first.genero,
          calibreMm: first.calibre_mm,
          puenteMm: first.puente_mm,
          varillaMm: first.varilla_mm,
          precio: first.precio,
          precioLista: first.precio_lista,
          permiteReceta: first.permite_receta,
          destacado: first.destacado,
          edicionLimitada: first.edicion_limitada,
          estado: first.estado,
          seoTitle: first.seo_title,
          seoDescription: first.seo_description,
          updatedById: userId,
        };

        const existing = await tx.producto.findUnique({
          where: { slug },
          select: { id: true, estado: true },
        });
        let productoId: string;
        if (existing) {
          await tx.producto.update({
            where: { id: existing.id },
            data: {
              ...data,
              publicadoEn:
                data.estado === 'PUBLICADO' && existing.estado !== 'PUBLICADO'
                  ? new Date()
                  : undefined,
              categorias: { set: categoriaIds.map((id) => ({ id })) },
            },
          });
          productoId = existing.id;
          result.productosActualizados++;
        } else {
          const created = await tx.producto.create({
            data: {
              ...data,
              createdById: userId,
              publicadoEn: data.estado === 'PUBLICADO' ? new Date() : null,
              categorias: { connect: categoriaIds.map((id) => ({ id })) },
            },
          });
          productoId = created.id;
          result.productosCreados++;
        }

        for (const [i, r] of filas.entries()) {
          if (!r.sku) continue;
          const sku = r.sku.toUpperCase();
          const vData = {
            colorArmazon: r.color_armazon ?? 'Único',
            colorArmazonHex: r.color_armazon_hex,
            colorLente: r.color_lente,
            colorLenteHex: r.color_lente_hex,
            stock: r.stock ?? 0,
            stockMinimo: r.stock_minimo ?? 0,
            activa: r.variante_activa,
            orden: r.variante_orden ?? i,
            updatedById: userId,
          };
          const imagenes = parseImagenes(r.imagenes);
          const existingV = await tx.variante.findUnique({
            where: { sku },
            select: { id: true, productoId: true },
          });
          if (existingV) {
            if (existingV.productoId !== productoId) {
              throw Errors.conflict(`El SKU ${sku} (fila ${r.fila}) pertenece a otro producto`);
            }
            await tx.variante.update({
              where: { id: existingV.id },
              data: { ...vData, imagenes: { deleteMany: {}, create: imagenes } },
            });
            result.variantesActualizadas++;
          } else {
            await tx.variante.create({
              data: {
                ...vData,
                sku,
                productoId,
                createdById: userId,
                imagenes: { create: imagenes },
              },
            });
            result.variantesCreadas++;
          }
        }
      }
    },
    { timeout: 60_000 },
  );

  return result;
}

const csvRoutes: FastifyPluginAsync = async (app) => {
  app.get('/productos/export.csv', async (_request, reply) => {
    const csv = await exportProductosCsv();
    const fecha = new Date().toISOString().slice(0, 10);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="vedere-productos-${fecha}.csv"`)
      .send(csv);
  });

  /** Acepta multipart (campo `file`) o body text/csv. */
  app.post('/productos/import', async (request) => {
    let csv: string;
    if (request.isMultipart()) {
      const file = await request.file();
      if (!file) throw Errors.badRequest('Enviá el CSV en el campo "file"');
      csv = (await file.toBuffer()).toString('utf8');
    } else if (typeof request.body === 'string') {
      csv = request.body;
    } else if (request.body && typeof request.body === 'object' && 'csv' in request.body) {
      csv = String((request.body as { csv: unknown }).csv);
    } else {
      throw Errors.badRequest('Enviá el CSV como multipart (file), text/csv o JSON { csv }');
    }
    return importProductosCsv(csv, request.user.sub);
  });
};

export default csvRoutes;
