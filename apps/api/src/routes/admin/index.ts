// Backoffice API. Catálogo: ADMIN y OPERADOR. Usuarios y ping: sólo ADMIN.
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
