import { prisma } from '@vedere/db';
import { buildApp } from './app.js';
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

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Apagando API...');
    clearInterval(reservasTimer);
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
