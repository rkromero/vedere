// Carrito abandonado (prompt 6): clientes con cuenta que dejaron ítems en el carrito. Aviso a la hora
// (CARRITO_ABANDONADO_1H) y a las 24 horas (CARRITO_ABANDONADO_24H) de la última modificación. Idempotente:
// cada aviso queda marcado en el carrito (aviso1hEn / aviso24hEn). Si el cliente creó un pedido después de
// tocar el carrito, no se le escribe (y se marca para no volver a mirarlo).
import { prisma } from '@vedere/db';
import type { Env } from '../env.js';
import { cargarConfig } from '../lib/pedidos.js';
import { enviarPlantilla } from '../lib/plantillas.js';

const HORA = 3600_000;
const LOTE = 200;

interface ItemCarrito {
  nombre?: string;
  color?: string;
  cantidad?: number;
}

export function resumenItems(items: unknown): string {
  if (!Array.isArray(items)) return '';
  return (items as ItemCarrito[])
    .filter((i) => i && typeof i === 'object' && i.nombre)
    .map((i) => `${i.cantidad ?? 1}× ${i.nombre}${i.color ? ` ${i.color}` : ''}`)
    .join(', ');
}

async function procesar(env: Env, ahora: Date, horas: 1 | 24): Promise<number> {
  const campo = horas === 1 ? 'aviso1hEn' : 'aviso24hEn';
  const tipo = horas === 1 ? 'CARRITO_ABANDONADO_1H' : 'CARRITO_ABANDONADO_24H';
  const limite = new Date(ahora.getTime() - horas * HORA);
  // El aviso de 1 h sólo aplica a carritos de entre 1 y 24 h; si el job estuvo caído y ya pasó un día, va directo el de 24 h.
  const piso = horas === 1 ? { gt: new Date(ahora.getTime() - 24 * HORA) } : {};
  const carritos = await prisma.carrito.findMany({
    where: { updatedAt: { lte: limite, ...piso }, [campo]: null, user: { rol: 'CLIENTE', activo: true } },
    include: { user: { select: { id: true, email: true, nombre: true } } },
    orderBy: { updatedAt: 'asc' },
    take: LOTE,
  });
  const web = env.WEB_URL.replace(/\/$/, '');
  let enviados = 0;
  for (const c of carritos) {
    const items = resumenItems(c.items);
    const marcar = { [campo]: ahora, ...(horas === 24 && !c.aviso1hEn ? { aviso1hEn: ahora } : {}) };
    if (!items) {
      await prisma.carrito.update({ where: { id: c.id }, data: marcar });
      continue;
    }
    const compro = await prisma.pedido.count({ where: { userId: c.userId, createdAt: { gte: c.updatedAt } } });
    if (compro > 0) {
      await prisma.carrito.update({ where: { id: c.id }, data: marcar });
      continue;
    }
    // Marcar antes de enviar: si dos instancias corren a la vez, sólo una manda.
    const claim = await prisma.carrito.updateMany({ where: { id: c.id, [campo]: null }, data: marcar });
    if (claim.count === 0) continue;
    const r = await enviarPlantilla(env, {
      tipo,
      para: c.user.email,
      vars: { nombre: c.user.nombre.split(' ')[0] || c.user.nombre, items, url: `${web}/checkout` },
      ctaHref: `${web}/checkout`,
    });
    if (r) enviados++;
  }
  return enviados;
}

/** Corre los dos avisos (1 h y 24 h). Devuelve cuántos emails mandó. */
export async function jobCarritoAbandonado(env: Env, ahora = new Date()): Promise<number> {
  const cfg = await cargarConfig();
  if (!cfg.carritoAbandonadoHabilitado) return 0;
  const a = await procesar(env, ahora, 1);
  const b = await procesar(env, ahora, 24);
  return a + b;
}
