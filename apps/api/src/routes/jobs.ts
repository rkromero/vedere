// Disparo manual de jobs (prompt 6): POST /jobs/:nombre con header x-cron-secret (CRON_SECRET), p. ej. desde GitHub Actions.
import type { FastifyPluginAsync } from 'fastify';

const jobsRoutes: FastifyPluginAsync = async (app) => {
  void app;
};

export default jobsRoutes;
