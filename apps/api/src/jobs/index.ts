// Jobs programados (prompt 6): carrito abandonado (1 h / 24 h), "volvió el stock" y Plan Rivedere.
// Cada job es una función idempotente que devuelve cuántos emails mandó. `iniciarJobs` los agenda con
// setInterval según el env (0 = apagado; en tests no se agenda nada); `ejecutarJob` los corre a mano
// (POST /jobs/:nombre con x-cron-secret, p. ej. desde GitHub Actions o un cron de Railway).
import type { FastifyInstance } from 'fastify';
import type { Env } from '../env.js';
import { jobCarritoAbandonado } from './carrito-abandonado.js';
import { jobRivedere } from './rivedere.js';
import { jobNiveles } from './niveles.js';
import { jobVencimientosMayoristas } from './vencimientos-mayoristas.js';
import { jobVolvioStock } from './volvio-stock.js';

export type Job = (env: Env, ahora?: Date) => Promise<number>;

export const JOBS: Record<string, Job> = {
  'carrito-abandonado': jobCarritoAbandonado,
  'volvio-stock': jobVolvioStock,
  rivedere: jobRivedere,
  // B2B 3: recordatorios de vencimiento de la cuenta corriente de las ópticas.
  'vencimientos-mayoristas': jobVencimientosMayoristas,
  // B2B 4: recálculo mensual de niveles (sólo actúa la primera vez de cada mes).
  niveles: jobNiveles,
};

export const NOMBRES_JOBS = Object.keys(JOBS);

export async function ejecutarJob(nombre: string, env: Env, ahora = new Date()): Promise<number> {
  const job = JOBS[nombre];
  if (!job) throw new Error(`Job desconocido: ${nombre}`);
  return job(env, ahora);
}

export function iniciarJobs(app: FastifyInstance): () => void {
  const timers: NodeJS.Timeout[] = [];
  const env = app.env;
  if (env.NODE_ENV === 'test') return () => {};

  const agendar = (nombres: string[], cadaMs: number) => {
    if (cadaMs <= 0) return;
    const t = setInterval(() => {
      for (const nombre of nombres) {
        ejecutarJob(nombre, env)
          .then((n) => n > 0 && app.log.info({ job: nombre, enviados: n }, 'Job ejecutado'))
          .catch((err) => app.log.error({ err, job: nombre }, 'Error en job'));
      }
    }, cadaMs);
    t.unref();
    timers.push(t);
  };

  agendar(['carrito-abandonado', 'volvio-stock', 'vencimientos-mayoristas'], env.CARRITO_ABANDONADO_INTERVALO_MIN * 60_000);
  agendar(['rivedere', 'niveles'], env.RIVEDERE_INTERVALO_HORAS * 3600_000);

  return () => timers.forEach((t) => clearInterval(t));
}
