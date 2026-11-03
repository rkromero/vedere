// Feeds de productos (prompt 6): Google Shopping (RSS 2.0) y Meta (CSV). Públicos, cacheados 5 minutos.
import type { FastifyPluginAsync } from 'fastify';
import { feedCacheado } from '../lib/feeds.js';

const feedsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/google.xml', async (_request, reply) => {
    const body = await feedCacheado(app.env, 'google');
    return reply
      .header('Content-Type', 'application/rss+xml; charset=utf-8')
      .header('Cache-Control', 'public, max-age=300')
      .send(body);
  });

  app.get('/meta.csv', async (_request, reply) => {
    const body = await feedCacheado(app.env, 'meta');
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'inline; filename="vedere-meta-catalog.csv"')
      .header('Cache-Control', 'public, max-age=300')
      .send(body);
  });
};

export default feedsRoutes;
