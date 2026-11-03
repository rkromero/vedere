// Backoffice API. Catálogo, promos, ópticas, cupones, bandeja, pedidos, promociones, creadores y config: ADMIN y OPERADOR.
// Usuarios, ping y edición de la configuración comercial: sólo ADMIN.
import type { FastifyPluginAsync } from 'fastify';
import marcasRoutes from './marcas.js';
import categoriasRoutes from './categorias.js';
import coleccionesRoutes from './colecciones.js';
import productosRoutes from './productos.js';
import variantesRoutes from './variantes.js';
import imagenesRoutes from './imagenes.js';
import csvRoutes from './csv.js';
import dashboardRoutes from './dashboard.js';
import usuariosRoutes from './usuarios.js';
import promosRoutes from './promos.js';
import opticasRoutes from './opticas.js';
import cuponesRoutes from './cupones.js';
import mensajesRoutes from './mensajes.js';
import pedidosRoutes from './pedidos.js';
import promocionesRoutes from './promociones.js';
import creadoresRoutes from './creadores.js';
import configRoutes from './config.js';

const adminRoutes: FastifyPluginAsync = async (app) => {
  // --- Catálogo y dashboard: staff (ADMIN u OPERADOR) ---
  await app.register(async (staff) => {
    staff.addHook('onRequest', staff.requireRole('ADMIN', 'OPERADOR'));
    await staff.register(dashboardRoutes);
    await staff.register(marcasRoutes, { prefix: '/marcas' });
    await staff.register(categoriasRoutes, { prefix: '/categorias' });
    await staff.register(coleccionesRoutes, { prefix: '/colecciones' });
    await staff.register(csvRoutes); // /productos/export.csv y /productos/import (antes que /productos/:id)
    await staff.register(productosRoutes, { prefix: '/productos' });
    await staff.register(variantesRoutes);
    await staff.register(imagenesRoutes);
    await staff.register(promosRoutes, { prefix: '/promos' });
    await staff.register(opticasRoutes, { prefix: '/opticas' });
    await staff.register(cuponesRoutes, { prefix: '/cupones' });
    await staff.register(mensajesRoutes);
    await staff.register(pedidosRoutes, { prefix: '/pedidos' });
    await staff.register(promocionesRoutes, { prefix: '/promociones' });
    await staff.register(creadoresRoutes, { prefix: '/creadores' });
    await staff.register(configRoutes); // GET /config-tienda (staff), PUT sólo ADMIN
  });

  // --- Sólo ADMIN ---
  await app.register(async (admin) => {
    admin.addHook('onRequest', admin.requireRole('ADMIN'));
    admin.get('/ping', async (request) => ({
      ok: true,
      rol: request.user.rol,
      userId: request.user.sub,
    }));
    await admin.register(usuariosRoutes, { prefix: '/usuarios' });
  });
};

export default adminRoutes;
