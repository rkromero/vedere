import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';

const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/dashboard', async () => {
    const [
      total,
      publicados,
      borradores,
      archivados,
      marcas,
      categorias,
      colecciones,
      usuarios,
      bajoStock,
      pedidosPorEstado,
      sinAsignar,
      vencidos,
      solicitudesPendientes,
      opticasActivas,
    ] = await Promise.all([
      prisma.producto.count(),
      prisma.producto.count({ where: { estado: 'PUBLICADO' } }),
      prisma.producto.count({ where: { estado: 'BORRADOR' } }),
      prisma.producto.count({ where: { estado: 'ARCHIVADO' } }),
      prisma.marca.count(),
      prisma.categoria.count(),
      prisma.coleccion.count(),
      prisma.user.count(),
      prisma.$queryRaw<
        Array<{
          id: string;
          sku: string;
          color_armazon: string;
          stock: number;
          stock_minimo: number;
          producto_id: string;
          producto_nombre: string;
          producto_slug: string;
          producto_estado: string;
        }>
      >`
          SELECT v.id, v.sku, v.color_armazon, v.stock, v.stock_minimo,
                 p.id AS producto_id, p.nombre AS producto_nombre, p.slug AS producto_slug, p.estado::text AS producto_estado
          FROM variantes v
          JOIN productos p ON p.id = v.producto_id
          WHERE v.activa = true AND v.stock < v.stock_minimo AND p.estado <> 'ARCHIVADO'
          ORDER BY (v.stock_minimo - v.stock) DESC, p.nombre ASC
          LIMIT 50`,
      prisma.pedido.groupBy({ by: ['estado'], _count: { _all: true } }),
      prisma.pedido.count({ where: { estado: 'PAGADO', opticaId: null } }),
      prisma.pedido.count({ where: { estado: 'ASIGNADO', aceptarAntesDe: { lt: new Date() } } }),
      prisma.solicitudCambio.count({ where: { estado: 'PENDIENTE' } }),
      prisma.optica.count({ where: { activa: true } }),
    ]);

    return {
      productos: { total, publicados, borradores, archivados },
      marcas,
      categorias,
      colecciones,
      usuarios,
      pedidos: {
        porEstado: Object.fromEntries(pedidosPorEstado.map((r) => [r.estado, r._count._all])),
        sinAsignar,
        vencidos,
        solicitudesPendientes,
      },
      opticasActivas,
      variantesBajoStock: bajoStock.map((r) => ({
        id: r.id,
        sku: r.sku,
        colorArmazon: r.color_armazon,
        stock: r.stock,
        stockMinimo: r.stock_minimo,
        faltante: r.stock_minimo - r.stock,
        producto: {
          id: r.producto_id,
          nombre: r.producto_nombre,
          slug: r.producto_slug,
          estado: r.producto_estado,
        },
      })),
    };
  });
};

export default dashboardRoutes;
