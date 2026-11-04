// B2B 4: recálculo mensual de los niveles de las ópticas. Corre el día 1 de cada mes (hora de Argentina): el job
// se agenda seguido pero sólo actúa si todavía no hay historial del mes, así que es idempotente. Devuelve
// cuántas ópticas cambiaron de nivel.
import { prisma } from '@vedere/db';
import type { Env } from '../env.js';
import { mesLocal, recalcularTodas } from '../lib/niveles.js';

export async function jobNiveles(env: Env, ahora = new Date()): Promise<number> {
  const mes = mesLocal(ahora);
  const hecho = await prisma.historialNivel.count({ where: { mes } });
  if (hecho > 0) return 0;
  const r = await recalcularTodas(env, ahora);
  return r.filter((x) => x.cambio).length;
}
