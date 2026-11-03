import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vedere/db';
import type { Categoria } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { uniqueSlug } from '../../lib/slug.js';
import { parse } from '../../lib/validate.js';
import { categoriaInput, categoriaUpdate } from '../../schemas/catalogo.js';

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  activa: z.enum(['true', 'false']).optional(),
  tree: z.enum(['true', 'false']).optional(),
});

type CategoriaNode = Categoria & { productos: number; hijas: CategoriaNode[] };

export function buildTree(items: Array<Categoria & { productos: number }>): CategoriaNode[] {
  const byId = new Map<string, CategoriaNode>();
  for (const c of items) byId.set(c.id, { ...c, hijas: [] });
  const roots: CategoriaNode[] = [];
  for (const node of byId.values()) {
    const parent = node.padreId ? byId.get(node.padreId) : undefined;
    if (parent) parent.hijas.push(node);
    else roots.push(node);
  }
  const sortRec = (nodes: CategoriaNode[]) => {
    nodes.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
    nodes.forEach((n) => sortRec(n.hijas));
  };
  sortRec(roots);
  return roots;
}

/** Ids de una categoría y todas sus descendientes. */
export async function categoriaConDescendientes(slugOrId: string): Promise<string[]> {
  const all = await prisma.categoria.findMany({ select: { id: true, slug: true, padreId: true } });
  const root = all.find((c) => c.slug === slugOrId || c.id === slugOrId);
  if (!root) return [];
  const ids = [root.id];
  const queue = [root.id];
  while (queue.length) {
    const current = queue.shift()!;
    for (const c of all) {
      if (c.padreId === current && !ids.includes(c.id)) {
        ids.push(c.id);
        queue.push(c.id);
      }
    }
  }
  return ids;
}

const categoriasRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const q = parse(listQuery, request.query);
    const where = {
      ...(q.q ? { nombre: { contains: q.q, mode: 'insensitive' as const } } : {}),
      ...(q.activa ? { activa: q.activa === 'true' } : {}),
    };
    const items = await prisma.categoria.findMany({
      where,
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: {
        _count: { select: { productos: true } },
        padre: { select: { id: true, nombre: true, slug: true } },
      },
    });
    const flat = items.map(({ _count, ...c }) => ({ ...c, productos: _count.productos }));
    if (q.tree === 'true') return { items: buildTree(flat), total: flat.length };
    return { items: flat, total: flat.length };
  });

  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const cat = await prisma.categoria.findUnique({
      where: { id: request.params.id },
      include: {
        _count: { select: { productos: true } },
        padre: { select: { id: true, nombre: true, slug: true } },
        hijas: { select: { id: true, nombre: true, slug: true, orden: true, activa: true } },
      },
    });
    if (!cat) throw Errors.notFound('Categoría no encontrada');
    const { _count, ...c } = cat;
    return { ...c, productos: _count.productos };
  });

  app.post('/', async (request, reply) => {
    const body = parse(categoriaInput, request.body);
    if (body.padreId) {
      const padre = await prisma.categoria.findUnique({ where: { id: body.padreId } });
      if (!padre) throw Errors.badRequest('La categoría padre no existe');
    }
    const slug = await uniqueSlug(
      body.slug ?? body.nombre,
      async (s) =>
        !!(await prisma.categoria.findUnique({ where: { slug: s }, select: { id: true } })),
    );
    const cat = await prisma.categoria.create({
      data: { ...body, slug, createdById: request.user.sub, updatedById: request.user.sub },
    });
    return reply.status(201).send(cat);
  });

  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const body = parse(categoriaUpdate, request.body);
    const existing = await prisma.categoria.findUnique({ where: { id: request.params.id } });
    if (!existing) throw Errors.notFound('Categoría no encontrada');
    if (body.padreId) {
      if (body.padreId === existing.id)
        throw Errors.badRequest('Una categoría no puede ser su propio padre');
      const descendientes = await categoriaConDescendientes(existing.id);
      if (descendientes.includes(body.padreId)) {
        throw Errors.badRequest('No se puede mover una categoría dentro de una de sus hijas');
      }
      const padre = await prisma.categoria.findUnique({ where: { id: body.padreId } });
      if (!padre) throw Errors.badRequest('La categoría padre no existe');
    }
    return prisma.categoria.update({
      where: { id: existing.id },
      data: { ...body, updatedById: request.user.sub },
    });
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await prisma.categoria.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { hijas: true } } },
    });
    if (!existing) throw Errors.notFound('Categoría no encontrada');
    if (existing._count.hijas > 0) {
      throw Errors.conflict('La categoría tiene subcategorías; movelas o eliminalas primero');
    }
    await prisma.categoria.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });
};

export default categoriasRoutes;
