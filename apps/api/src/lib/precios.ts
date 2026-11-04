// Actualización masiva de precios por porcentaje (web o mayorista), auditada en actualizaciones_precio.
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { Errors } from './errors.js';
import { paginate, pageResponse } from './pagination.js';
import type { Pagination } from './pagination.js';
import { dec } from './serialize.js';
import { categoriaConDescendientes } from '../routes/admin/categorias.js';

export interface ActualizarPreciosInput {
  campo: 'PRECIO' | 'PRECIO_MAYORISTA';
  porcentaje: number;
  alcance: 'TODOS' | 'CATEGORIA' | 'MARCA' | 'COLECCION';
  alcanceId?: string | null;
  redondeo: number;
  simular: boolean;
}

/** Aplica el porcentaje y redondea (0.01 = centavos, 1 = pesos, 10 = decena, 100 = centena). */
export function aplicarPorcentaje(precio: number, porcentaje: number, redondeo: number): number {
  const nuevo = precio * (1 + porcentaje / 100);
  const r = Math.round(nuevo / redondeo) * redondeo;
  return Math.max(0, Math.round(r * 100) / 100);
}

async function resolverAlcance(input: ActualizarPreciosInput): Promise<{ where: Prisma.ProductoWhereInput; nombre: string | null }> {
  if (input.alcance === 'TODOS') return { where: {}, nombre: 'Todos los productos' };
  const id = input.alcanceId!;
  if (input.alcance === 'CATEGORIA') {
    const c = await prisma.categoria.findUnique({ where: { id }, select: { nombre: true } });
    if (!c) throw Errors.badRequest('La categoría indicada no existe');
    const ids = await categoriaConDescendientes(id);
    return { where: { categorias: { some: { id: { in: ids } } } }, nombre: c.nombre };
  }
  if (input.alcance === 'MARCA') {
    const m = await prisma.marca.findUnique({ where: { id }, select: { nombre: true } });
    if (!m) throw Errors.badRequest('La marca indicada no existe');
    return { where: { marcaId: id }, nombre: m.nombre };
  }
  const c = await prisma.coleccion.findUnique({ where: { id }, select: { nombre: true } });
  if (!c) throw Errors.badRequest('La colección indicada no existe');
  return { where: { coleccionId: id }, nombre: c.nombre };
}

export async function actualizarPrecios(input: ActualizarPreciosInput, usuario: { id: string; nombre: string }) {
  const { where, nombre } = await resolverAlcance(input);
  const mayorista = input.campo === 'PRECIO_MAYORISTA';
  const productos = await prisma.producto.findMany({
    // El mayorista sólo se actualiza donde ya está cargado (no se inventa un precio a partir de null).
    where: mayorista ? { AND: [where, { precioMayorista: { not: null } }] } : where,
    select: { id: true, nombre: true, precio: true, precioMayorista: true },
    orderBy: { nombre: 'asc' },
  });
  const detalle = productos.map((p) => {
    const antes = dec(mayorista ? p.precioMayorista : p.precio) ?? 0;
    return { id: p.id, nombre: p.nombre, antes, despues: aplicarPorcentaje(antes, input.porcentaje, input.redondeo) };
  });
  const resumen = {
    campo: input.campo,
    porcentaje: input.porcentaje,
    alcance: input.alcance,
    alcanceNombre: nombre,
    productosAfectados: detalle.length,
    detalle,
  };
  if (input.simular) return { ...resumen, simulado: true, id: null };
  if (detalle.length === 0) throw Errors.badRequest('No hay productos para actualizar con ese alcance');

  const registro = await prisma.$transaction(
    async (tx) => {
      for (const d of detalle) {
        await tx.producto.update({
          where: { id: d.id },
          data: { [mayorista ? 'precioMayorista' : 'precio']: d.despues, updatedById: usuario.id },
        });
      }
      return tx.actualizacionPrecio.create({
        data: {
          campo: input.campo,
          porcentaje: input.porcentaje,
          alcance: input.alcance,
          alcanceId: input.alcanceId ?? null,
          alcanceNombre: nombre,
          productosAfectados: detalle.length,
          detalle,
          usuarioId: usuario.id,
          usuarioNombre: usuario.nombre,
        },
      });
    },
    { timeout: 60_000 },
  );
  return { ...resumen, simulado: false, id: registro.id };
}

export async function historialPrecios(q: Pagination) {
  const [total, items] = await Promise.all([
    prisma.actualizacionPrecio.count(),
    prisma.actualizacionPrecio.findMany({ orderBy: { createdAt: 'desc' }, ...paginate(q) }),
  ]);
  return pageResponse(
    items.map((r) => ({ ...r, porcentaje: dec(r.porcentaje) ?? 0 })),
    total,
    q,
  );
}
