// Carga de stock por código de barras. Montado bajo /admin.
//   GET  /codigo-barras/:codigo  → variante ya cargada con ese código (o SKU) y/o sugerencia con datos externos
//   POST /variantes/:id/stock    → suma (o resta) unidades al stock de una variante
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';
import { serializeVariante } from '../../lib/serialize.js';
import {
  buscarCodigoExterno,
  formasEquivalentes,
  normalizarCodigo,
} from '../../lib/codigo-barras.js';
import { ajusteStockInput } from '../../schemas/catalogo.js';
import { identificarPorFotos } from '../../lib/identificar-foto.js';

const normalizarNombre = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const codigoBarrasRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { codigo: string }; Querystring: { externo?: string } }>(
    '/codigo-barras/:codigo',
    async (request) => {
      const codigo = normalizarCodigo(request.params.codigo);
      if (!codigo) throw Errors.badRequest('Código de barras inválido');

      const variante = await prisma.variante.findFirst({
        where: { OR: [{ codigoBarras: { in: formasEquivalentes(codigo) } }, { sku: codigo }] },
        include: {
          imagenes: { orderBy: { orden: 'asc' }, take: 1 },
          producto: {
            select: {
              id: true,
              nombre: true,
              slug: true,
              estado: true,
              marca: { select: { nombre: true } },
            },
          },
        },
      });

      const existente = variante
        ? {
            varianteId: variante.id,
            productoId: variante.producto.id,
            productoNombre: variante.producto.nombre,
            productoEstado: variante.producto.estado,
            marca: variante.producto.marca?.nombre ?? null,
            colorArmazon: variante.colorArmazon,
            colorLente: variante.colorLente,
            sku: variante.sku,
            codigoBarras: variante.codigoBarras,
            stock: variante.stock,
            stockMinimo: variante.stockMinimo,
            activa: variante.activa,
            imagen: variante.imagenes[0]?.urlMiniatura ?? variante.imagenes[0]?.url ?? null,
          }
        : null;

      // Si ya está cargado no gastamos consultas externas, salvo que se pidan (?externo=1).
      if (existente && request.query.externo !== '1') {
        return { codigo, existente, sugerencia: null, marcaId: null, avisos: [] };
      }

      const { sugerencia, avisos } = await buscarCodigoExterno(app.env, codigo);

      let marcaId: string | null = null;
      if (sugerencia?.marca) {
        const buscada = normalizarNombre(sugerencia.marca);
        const marcas = await prisma.marca.findMany({
          select: { id: true, nombre: true, slug: true },
        });
        marcaId =
          marcas.find(
            (m) => normalizarNombre(m.nombre) === buscada || normalizarNombre(m.slug) === buscada,
          )?.id ?? null;
      }

      return { codigo, existente, sugerencia, marcaId, avisos };
    },
  );

  /** Estado de la identificación por foto (para mostrar u ocultar el botón). */
  app.get('/identificar-foto/config', async () => ({ habilitada: !!app.env.ANTHROPIC_API_KEY }));

  /**
   * Identifica un anteojo a partir de 1 a 4 fotos (multipart, campo `file` repetido): patilla por dentro,
   * frente, costado o etiqueta. Devuelve la sugerencia de producto y las fotos aptas para catálogo ya guardadas.
   */
  app.post(
    '/identificar-foto',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request) => {
      const fotos: Buffer[] = [];
      for await (const part of request.files({ limits: { files: 4 } })) {
        if (!part.mimetype.startsWith('image/')) {
          throw Errors.badRequest(`Tipo de archivo no permitido: ${part.mimetype}`);
        }
        const buffer = await part.toBuffer();
        if (part.file.truncated) {
          throw Errors.badRequest(`Cada foto puede pesar hasta ${app.env.MAX_UPLOAD_MB} MB`);
        }
        fotos.push(buffer);
      }
      if (fotos.length === 0) throw Errors.badRequest('Enviá al menos una foto en el campo "file"');
      return identificarPorFotos(app.env, fotos);
    },
  );

  app.post<{ Params: { id: string } }>('/variantes/:id/stock', async (request) => {
    const { cantidad } = parse(ajusteStockInput, request.body);
    // Update condicional: nunca deja el stock negativo, aunque haya dos escaneos simultáneos.
    const r = await prisma.variante.updateMany({
      where: { id: request.params.id, ...(cantidad < 0 ? { stock: { gte: -cantidad } } : {}) },
      data: { stock: { increment: cantidad }, updatedById: request.user.sub },
    });
    if (r.count === 0) {
      const existe = await prisma.variante.findUnique({
        where: { id: request.params.id },
        select: { stock: true },
      });
      if (!existe) throw Errors.notFound('Variante no encontrada');
      throw Errors.badRequest(
        `No hay stock suficiente para restar ${-cantidad} (quedan ${existe.stock})`,
      );
    }
    const v = await prisma.variante.findUniqueOrThrow({
      where: { id: request.params.id },
      include: { imagenes: { orderBy: { orden: 'asc' } } },
    });
    return serializeVariante(v);
  });
};

export default codigoBarrasRoutes;
