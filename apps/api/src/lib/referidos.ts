// Referidos (prompt 6): link único por cliente (/r/<codigo>); cuando un referido paga su primera compra,
// ambos reciben un cupón de descuento (ConfigTienda.referidoDescuentoPct) por email (REFERIDO_RECOMPENSA).
import { randomInt } from 'node:crypto';
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import type { Env } from '../env.js';
import type { PedidoFull } from './pedidos.js';
import { cargarConfig } from './pedidos.js';
import { enviarPlantilla } from './plantillas.js';
import { dec } from './serialize.js';

type Db = Prisma.TransactionClient | typeof prisma;

/** Sin caracteres confusos (0/O, 1/I/L). */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const VIGENCIA_DIAS = 90;

export function codigoAleatorio(largo: number): string {
  let s = '';
  for (let i = 0; i < largo; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}

export function linkReferido(env: Env, codigo: string): string {
  return `${env.WEB_URL.replace(/\/$/, '')}/r/${codigo}`;
}

/** Devuelve el código de referido del usuario; lo genera (único) si todavía no tiene. */
export async function asegurarCodigoReferido(userId: string, db: Db = prisma): Promise<string> {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { codigoReferido: true } });
  if (u.codigoReferido) return u.codigoReferido;
  for (let intento = 0; intento < 10; intento++) {
    const codigo = codigoAleatorio(8);
    try {
      await db.user.update({ where: { id: userId }, data: { codigoReferido: codigo } });
      return codigo;
    } catch (err) {
      // Colisión del unique: probar otro.
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
  }
  throw new Error('No se pudo generar un código de referido');
}

/** Usuario que refiere a partir del código del link (null si no existe o está inactivo). */
export async function usuarioPorCodigoReferido(codigo: string, db: Db = prisma) {
  return db.user.findFirst({ where: { codigoReferido: codigo.toUpperCase(), activo: true }, select: { id: true } });
}

export const fmtPct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/\.?0+$/, '')}%`;
export const fmtFecha = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

async function codigoCuponUnico(prefijo: string, db: Db): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const codigo = `${prefijo}-${codigoAleatorio(4)}-${codigoAleatorio(4)}`;
    if (!(await db.cupon.findUnique({ where: { codigo }, select: { id: true } }))) return codigo;
  }
  throw new Error('No se pudo generar el código del cupón');
}

/**
 * Si el pedido es la primera compra pagada de un usuario referido, emite un cupón para cada uno (el que
 * refirió y el referido) y les avisa por email. Idempotente: toma `referidoRecompensadoEn` con un UPDATE
 * condicional, así un webhook repetido no duplica cupones.
 */
export async function recompensarReferido(pedido: PedidoFull, env: Env): Promise<void> {
  if (!pedido.userId || pedido.estadoPago !== 'APROBADO') return;
  const ahora = new Date();
  const claim = await prisma.user.updateMany({
    where: { id: pedido.userId, referidoPorId: { not: null }, referidoRecompensadoEn: null },
    data: { referidoRecompensadoEn: ahora },
  });
  if (claim.count === 0) return;

  const referido = await prisma.user.findUniqueOrThrow({
    where: { id: pedido.userId },
    include: { referidoPor: { select: { id: true, email: true, nombre: true, activo: true } } },
  });
  const referente = referido.referidoPor;
  if (!referente) return;

  const cfg = await cargarConfig();
  const pct = dec(cfg.referidoDescuentoPct) ?? 10;
  const vigenciaHasta = new Date(ahora.getTime() + VIGENCIA_DIAS * 86400 * 1000);

  const { cuponReferente, cuponReferido } = await prisma.$transaction(async (tx) => {
    const base = {
      tipo: 'PORCENTAJE' as const,
      valor: pct,
      usosMax: 1,
      usosMaxPorCliente: 1,
      acumulable: false,
      activo: true,
      vigenciaDesde: ahora,
      vigenciaHasta,
    };
    const cuponReferente = await tx.cupon.create({
      data: {
        ...base,
        codigo: await codigoCuponUnico('REF', tx),
        descripcion: `Referidos (${referente.email}): ${referido.nombre} hizo su primera compra (pedido ${pedido.numero})`,
      },
    });
    const cuponReferido = await tx.cupon.create({
      data: {
        ...base,
        codigo: await codigoCuponUnico('REF', tx),
        descripcion: `Referidos (${referido.email}): bienvenida por recomendación de ${referente.nombre}`,
      },
    });
    return { cuponReferente, cuponReferido };
  });

  const web = env.WEB_URL.replace(/\/$/, '');
  const comun = { descuento: fmtPct(pct), vigencia: fmtFecha(vigenciaHasta), url: `${web}/mi-cuenta/referidos` };
  if (referente.activo) {
    await enviarPlantilla(env, {
      tipo: 'REFERIDO_RECOMPENSA',
      para: referente.email,
      vars: { ...comun, nombre: referente.nombre.split(' ')[0] || referente.nombre, cupon: cuponReferente.codigo, nombreAmigo: referido.nombre },
      ctaHref: `${web}/`,
      pedidoId: pedido.id,
    });
  }
  await enviarPlantilla(env, {
    tipo: 'REFERIDO_RECOMPENSA',
    para: referido.email,
    vars: { ...comun, nombre: referido.nombre.split(' ')[0] || referido.nombre, cupon: cuponReferido.codigo, nombreAmigo: referente.nombre },
    ctaHref: `${web}/`,
    pedidoId: pedido.id,
  });
}

/**
 * Cupones emitidos para un email por los programas de la cuenta (referidos y Plan Rivedere). Como el cupón no
 * tiene dueño en el esquema, la descripción empieza con "<Programa> (<email>)": ese prefijo es la convención.
 */
export async function cuponesDelCliente(email: string, db: Db = prisma) {
  return db.cupon.findMany({
    where: { OR: [{ descripcion: { startsWith: `Referidos (${email})` } }, { descripcion: { startsWith: `Plan Rivedere (${email})` } }] },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
