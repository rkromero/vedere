// "Volvió el stock" (prompt 6): avisos pendientes (AvisoStock.notificadoEn null) cuya variante volvió a tener
// stock → email VOLVIO_STOCK y se marca como notificado. Idempotente por claim atómico.
import { prisma } from '@vedere/db';
import type { Env } from '../env.js';
import { enviarPlantilla } from '../lib/plantillas.js';

const LOTE = 200;

export async function jobVolvioStock(env: Env, ahora = new Date()): Promise<number> {
  const avisos = await prisma.avisoStock.findMany({
    where: { notificadoEn: null, variante: { activa: true, stock: { gt: 0 }, producto: { estado: 'PUBLICADO' } } },
    include: { variante: { include: { producto: { select: { nombre: true, slug: true } } } } },
    orderBy: { createdAt: 'asc' },
    take: LOTE,
  });
  const web = env.WEB_URL.replace(/\/$/, '');
  let enviados = 0;
  for (const a of avisos) {
    const claim = await prisma.avisoStock.updateMany({ where: { id: a.id, notificadoEn: null }, data: { notificadoEn: ahora } });
    if (claim.count === 0) continue;
    const url = `${web}/p/${a.variante.producto.slug}?variante=${a.variante.id}`;
    const r = await enviarPlantilla(env, {
      tipo: 'VOLVIO_STOCK',
      para: a.email,
      vars: { producto: a.variante.producto.nombre, color: a.variante.colorArmazon, url },
      ctaHref: url,
    });
    if (r) enviados++;
  }
  return enviados;
}
