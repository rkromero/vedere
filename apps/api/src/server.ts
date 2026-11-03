import { prisma } from '@vedere/db';
import { buildApp } from './app.js';

async function main() {
  const app = await buildApp();
  const { PORT, HOST } = app.env;

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Apagando API...');
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
