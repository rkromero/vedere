// B2B 3: recordatorios de vencimiento de la cuenta corriente. Por cada pedido mayorista con saldo
// pendiente: un email 3 días antes del vencimiento y otro el día que vence (o después, si el job no
// corrió ese día). Cada aviso se manda una sola vez (claim atómico sobre recordatorio*En).
import { prisma } from '@vedere/db';
import type { Env } from '../env.js';
import { ars } from '../lib/cuenta-corriente.js';
import { enviarEmail, layoutEmail } from '../lib/email.js';
import { round2 } from '../lib/mayorista.js';
import { dec } from '../lib/serialize.js';

const TZ_OFFSET_MS = -3 * 3600_000;
const DIA = 86_400_000;
export const DIAS_AVISO_PREVIO = 3;

/** Días de calendario (Argentina) entre hoy y el vencimiento: 0 = vence hoy, negativo = vencido. */
export function diasHasta(vence: Date, ahora: Date): number {
  const dia = (d: Date) => Math.floor((d.getTime() + TZ_OFFSET_MS) / DIA);
  return dia(vence) - dia(ahora);
}

const fecha = (d: Date) => d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

export async function jobVencimientosMayoristas(env: Env, ahora = new Date()): Promise<number> {
  const limite = new Date(ahora.getTime() + (DIAS_AVISO_PREVIO + 1) * DIA);
  const pedidos = await prisma.pedidoMayorista.findMany({
    where: {
      venceEn: { not: null, lt: limite },
      OR: [{ recordatorioPrevioEn: null }, { recordatorioVencidoEn: null }],
    },
    select: {
      id: true,
      numero: true,
      total: true,
      venceEn: true,
      usuarioEmail: true,
      recordatorioPrevioEn: true,
      recordatorioVencidoEn: true,
      optica: { select: { email: true } },
      imputaciones: { select: { monto: true } },
    },
    take: 500,
  });
  const web = env.WEB_URL.replace(/\/$/, '');
  let enviados = 0;
  for (const p of pedidos) {
    const pendiente = round2(dec(p.total)! - p.imputaciones.reduce((a, i) => a + dec(i.monto)!, 0));
    if (pendiente <= 0.004) continue;
    const d = diasHasta(p.venceEn!, ahora);
    let tipo: 'previo' | 'vencido' | null = null;
    if (d <= 0 && !p.recordatorioVencidoEn) tipo = 'vencido';
    else if (d >= 1 && d <= DIAS_AVISO_PREVIO && !p.recordatorioPrevioEn) tipo = 'previo';
    if (!tipo) continue;

    const campo = tipo === 'previo' ? 'recordatorioPrevioEn' : 'recordatorioVencidoEn';
    const claim = await prisma.pedidoMayorista.updateMany({ where: { id: p.id, [campo]: null }, data: { [campo]: ahora } });
    if (claim.count === 0) continue;

    const titulo =
      tipo === 'previo'
        ? `Tu pedido ${p.numero} vence el ${fecha(p.venceEn!)}`
        : d === 0
          ? `Hoy vence tu pedido ${p.numero}`
          : `Venció tu pedido ${p.numero}`;
    const cuerpo =
      `<p>Saldo pendiente: <strong>${ars(pendiente)}</strong> (vencimiento ${fecha(p.venceEn!)}).</p>` +
      (tipo === 'previo'
        ? '<p>Si ya pagaste, informá el pago con el comprobante desde tu cuenta así lo imputamos.</p>'
        : '<p>Para seguir comprando sin demoras, regularizá el saldo o informá el pago desde tu cuenta.</p>');
    await enviarEmail(
      env,
      {
        para: p.optica.email || p.usuarioEmail,
        asunto: titulo,
        html: layoutEmail(env, { titulo, cuerpo, cta: { label: 'Ver mi cuenta corriente', href: `${web}/optica/cuenta` } }),
      },
      { tipo: tipo === 'previo' ? 'CUENTA_VENCIMIENTO_PREVIO' : 'CUENTA_VENCIMIENTO' },
    );
    await prisma.eventoPedidoMayorista.create({
      data: { pedidoId: p.id, tipo: 'EMAIL', nota: `Recordatorio enviado: ${titulo}`, interno: true, usuarioNombre: 'Sistema' },
    });
    enviados++;
  }
  return enviados;
}
