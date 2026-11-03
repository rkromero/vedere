import { prisma } from '@vedere/db';
import { buildApp } from './app.js';
import { procesarVencidos } from './lib/asignacion.js';
import { liberarReservasVencidas } from './lib/reservas.js';

async function main() {
  const app = await buildApp();
  const { PORT, HOST } = app.env;

  // Libera las reservas de stock vencidas (30 min en Mercado Pago, horas en transferencia).
  const reservasTimer = setInterval(() => {
    liberarReservasVencidas()
      .then((n) => n > 0 && app.log.info({ liberadas: n }, 'Reservas de stock vencidas liberadas'))
      .catch((err) => app.log.error({ err }, 'Error liberando reservas vencidas'));
  }, 60_000);
  reservasTimer.unref();

  // Pedidos asignados que la óptica no aceptó en el plazo (horas hábiles): pasan a la siguiente.
  const asignacionTimer = setInterval(() => {
    procesarVencidos(app.env)
      .then((n) => n > 0 && app.log.info({ reasignados: n }, 'Pedidos con plazo de aceptación vencido reasignados'))
      .catch((err) => app.log.error({ err }, 'Error reasignando pedidos vencidos'));
  }, app.env.ASIGNACION_INTERVALO_MIN * 60_000);
  asignacionTimer.unref();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Apagando API...');
    clearInterval(reservasTimer);
    clearInterval(asignacionTimer);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: PORT, host: HOST });
}

main().catch((err) => {
  console.error('No se pudo iniciar la API:', err);
  process.exit(1);
});
