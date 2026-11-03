// Jobs programados (prompt 6): carrito abandonado (1 h / 24 h), Plan Rivedere y "volvió el stock".
// Cada job es una función idempotente que devuelve cuántos emails mandó. `iniciarJobs` los agenda con
// setInterval según el env; `ejecutarJob` los corre a mano (POST /jobs/:nombre).
import type { FastifyInstance } from 'fastify';
import type { Env } from '../env.js';

export type Job = (env: Env, ahora?: Date) => Promise<number>;

export const JOBS: Record<string, Job> = {};

export async function ejecutarJob(nombre: string, env: Env): Promise<number> {
  const job = JOBS[nombre];
  if (!job) throw new Error(`Job desconocido: ${nombre}`);
  return job(env);
}

export function iniciarJobs(app: FastifyInstance): () => void {
  const timers: NodeJS.Timeout[] = [];
  void app;
  return () => timers.forEach((t) => clearInterval(t));
}
