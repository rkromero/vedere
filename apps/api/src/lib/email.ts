// Emails transaccionales (Resend vía HTTP, sin SDK). Cada envío queda registrado en `emails_enviados`;
// sin RESEND_API_KEY el email se registra como SIMULADO (desarrollo y tests) y no sale nada.
import { prisma } from '@vedere/db';
import type { EstadoPedido, Prisma } from '@vedere/db';
import type { Env } from '../env.js';
import { dec } from './serialize.js';
import { enviarPlantilla } from './plantillas.js';
import type { VariablesPlantilla } from './plantillas.js';

type Db = Prisma.TransactionClient | typeof prisma;

export interface EmailMensaje {
  para: string;
  asunto: string;
  html: string;
  texto?: string;
  replyTo?: string;
}

export interface EmailContexto {
  pedidoId?: string | null;
  tipo: string;
}

export function emailHabilitado(env: Env): boolean {
  return !!env.RESEND_API_KEY;
}

/** Envía (o simula) un email y lo registra. Nunca lanza: un fallo de email no debe frenar el pedido. */
export async function enviarEmail(env: Env, msg: EmailMensaje, ctx: EmailContexto, db: Db = prisma) {
  const base = { pedidoId: ctx.pedidoId ?? null, tipo: ctx.tipo, para: msg.para, asunto: msg.asunto };
  if (!env.RESEND_API_KEY) {
    return db.emailEnviado.create({ data: { ...base, estado: 'SIMULADO', proveedor: 'simulado' } });
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [msg.para],
        subject: msg.asunto,
        html: msg.html,
        text: msg.texto ?? htmlATexto(msg.html),
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) {
      return db.emailEnviado.create({
        data: { ...base, estado: 'ERROR', proveedor: 'resend', error: body?.message ?? `HTTP ${res.status}` },
      });
    }
    return db.emailEnviado.create({
      data: { ...base, estado: 'ENVIADO', proveedor: 'resend', externoId: body?.id ?? null },
    });
  } catch (err) {
    return db.emailEnviado.create({
      data: { ...base, estado: 'ERROR', proveedor: 'resend', error: err instanceof Error ? err.message : 'error' },
    });
  }
}

function htmlATexto(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapar(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ars = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

/** Layout mínimo, blanco y negro, compatible con clientes de email. */
export function layoutEmail(env: Env, input: { titulo: string; cuerpo: string; cta?: { label: string; href: string } }) {
  const web = env.WEB_URL.replace(/\/$/, '');
  return `<!doctype html><html lang="es"><body style="margin:0;background:#F2F2F0;font-family:Arial,Helvetica,sans-serif;color:#0A0A0A">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F2F2F0;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="padding:24px 28px 8px"><a href="${web}" style="font-size:22px;font-weight:800;letter-spacing:-.02em;color:#0A0A0A;text-decoration:none">VEDERE</a></td></tr>
<tr><td style="padding:8px 28px 0"><h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${escapar(input.titulo)}</h1></td></tr>
<tr><td style="padding:0 28px 8px;font-size:15px;line-height:1.55">${input.cuerpo}</td></tr>
${input.cta ? `<tr><td style="padding:12px 28px 24px"><a href="${input.cta.href}" style="display:inline-block;background:#0A0A0A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapar(input.cta.label)}</a></td></tr>` : '<tr><td style="padding:0 0 24px"></td></tr>'}
<tr><td style="padding:16px 28px;border-top:1px solid #E5E5E2;font-size:12px;color:#8A8A86">Vedere · Anteojos online, ajustados en tu óptica más cercana.<br>Si tenés dudas, respondé este email.</td></tr>
</table></td></tr></table></body></html>`;
}

// ---------- Plantillas por estado del pedido (al cliente) ----------

export interface PedidoParaEmail {
  id: string;
  numero: string;
  email: string;
  nombre: string;
  estado: EstadoPedido;
  modalidad: 'RETIRO_OPTICA' | 'ENVIO_DOMICILIO';
  total: Prisma.Decimal | number;
  numeroSeguimiento?: string | null;
  items?: Array<{ nombre: string; color: string; cantidad: number }>;
  optica?: {
    nombre: string;
    direccion: string;
    localidad: string;
    horarios: string | null;
    whatsapp: string | null;
    telefono: string | null;
  } | null;
}

function bloqueOptica(o: NonNullable<PedidoParaEmail['optica']>): string {
  const contacto = [o.whatsapp ? `WhatsApp ${escapar(o.whatsapp)}` : null, o.telefono ? `Tel. ${escapar(o.telefono)}` : null]
    .filter(Boolean)
    .join(' · ');
  return `<p style="margin:12px 0;padding:12px 14px;background:#F2F2F0;border-radius:8px"><strong>${escapar(o.nombre)}</strong><br>${escapar(o.direccion)}, ${escapar(o.localidad)}${o.horarios ? `<br>${escapar(o.horarios)}` : ''}${contacto ? `<br>${contacto}` : ''}</p>`;
}

function bloqueItems(items: PedidoParaEmail['items']): string {
  if (!items?.length) return '';
  return `<ul style="margin:8px 0 12px;padding-left:18px">${items
    .map((i) => `<li>${i.cantidad}× ${escapar(i.nombre)} · ${escapar(i.color)}</li>`)
    .join('')}</ul>`;
}

export function plantillaEstado(
  env: Env,
  p: PedidoParaEmail,
  estado: EstadoPedido,
  extra: { nota?: string | null } = {},
): { asunto: string; html: string } | null {
  const nombre = escapar(p.nombre.split(' ')[0] || p.nombre);
  const n = escapar(p.numero);
  const web = env.WEB_URL.replace(/\/$/, '');
  const cta = { label: 'Ver mi pedido', href: `${web}/gracias/${p.id}` };
  const retiro = p.modalidad === 'RETIRO_OPTICA';
  const o = p.optica ?? null;
  const total = ars(dec(p.total) ?? 0);
  let titulo = '';
  let cuerpo = '';
  switch (estado) {
    case 'PAGADO':
      titulo = `Recibimos tu pago · Pedido ${n}`;
      cuerpo = `<p>Hola ${nombre}, ¡gracias por tu compra! Ya acreditamos el pago de ${total}.</p>${bloqueItems(p.items)}<p>En breve te contamos qué óptica socia va a armar${retiro ? ' y entregarte' : ' y enviarte'} tus anteojos.</p>`;
      break;
    case 'ASIGNADO':
      titulo = `Tu pedido ${n} ya tiene óptica asignada`;
      cuerpo = `<p>Hola ${nombre}, tu pedido lo va a preparar esta óptica socia:</p>${o ? bloqueOptica(o) : ''}<p>${retiro ? 'Cuando esté listo te avisamos para que pases a retirarlo y te lo ajusten.' : 'Cuando esté listo lo despachan a tu domicilio.'}</p>`;
      break;
    case 'ACEPTADO':
      titulo = `La óptica confirmó tu pedido ${n}`;
      cuerpo = `<p>Hola ${nombre}, ${o ? `<strong>${escapar(o.nombre)}</strong>` : 'la óptica'} ya tomó tu pedido y empieza a prepararlo.</p>${o ? bloqueOptica(o) : ''}`;
      break;
    case 'EN_ARMADO':
      titulo = `Estamos armando tus anteojos · ${n}`;
      cuerpo = `<p>Hola ${nombre}, tus anteojos están en armado. Te avisamos apenas estén listos.</p>`;
      break;
    case 'LISTO':
      titulo = retiro ? `Tus anteojos están listos para retirar · ${n}` : `Tus anteojos están listos · ${n}`;
      cuerpo = retiro
        ? `<p>Hola ${nombre}, ¡ya podés pasar a buscarlos! Llevá tu DNI. En la óptica te los ajustan en el momento.</p>${o ? bloqueOptica(o) : ''}`
        : `<p>Hola ${nombre}, tus anteojos están listos y salen en breve hacia tu domicilio.</p>`;
      break;
    case 'ENVIADO':
      titulo = `Tu pedido ${n} está en camino`;
      cuerpo = `<p>Hola ${nombre}, tu pedido ya fue despachado.</p>${p.numeroSeguimiento ? `<p>Número de seguimiento: <strong>${escapar(p.numeroSeguimiento)}</strong></p>` : ''}<p>Si necesitás un ajuste cuando lo recibas, acercate a la óptica sin cargo.</p>${o ? bloqueOptica(o) : ''}`;
      break;
    case 'ENTREGADO':
      titulo = `Pedido ${n} entregado y ajustado`;
      cuerpo = `<p>Hola ${nombre}, ¡listo! Tu pedido quedó entregado y ajustado. Tenés 30 días para cambios y devoluciones.</p>`;
      break;
    case 'CANCELADO':
      titulo = `Tu pedido ${n} fue cancelado`;
      cuerpo = `<p>Hola ${nombre}, cancelamos tu pedido${extra.nota ? `: ${escapar(extra.nota)}` : '.'}</p><p>Si pagaste, el reintegro se procesa por el mismo medio de pago.</p>`;
      break;
    case 'DEVUELTO':
      titulo = `Registramos la devolución del pedido ${n}`;
      cuerpo = `<p>Hola ${nombre}, registramos la devolución de tu pedido.${extra.nota ? ` ${escapar(extra.nota)}` : ''}</p>`;
      break;
    default:
      return null;
  }
  return { asunto: titulo, html: layoutEmail(env, { titulo, cuerpo, cta }) };
}

/** Variables comunes de las plantillas de pedido ({{nombre}}, {{numero}}, {{total}}, {{optica}}, ...). */
export function variablesPedido(env: Env, p: PedidoParaEmail): VariablesPlantilla {
  const web = env.WEB_URL.replace(/\/$/, '');
  const o = p.optica ?? null;
  return {
    nombre: p.nombre.split(' ')[0] || p.nombre,
    numero: p.numero,
    total: ars(dec(p.total) ?? 0),
    optica: o?.nombre ?? 'tu óptica socia',
    opticaDireccion: o ? `${o.direccion}, ${o.localidad}` : '',
    seguimiento: p.numeroSeguimiento ?? '',
    url: `${web}/gracias/${p.id}`,
  };
}

/** Bloques HTML (ya escapados) que acompañan a los emails de pedido: ítems y óptica. */
export function extraPedidoHtml(p: PedidoParaEmail, opts: { optica?: boolean; nota?: string | null } = {}): string {
  const nota = opts.nota ? `<p style="margin:0 0 12px">${escapar(opts.nota)}</p>` : '';
  return nota + bloqueItems(p.items) + (opts.optica && p.optica ? bloqueOptica(p.optica) : '');
}

const ESTADOS_CON_OPTICA: EstadoPedido[] = ['ASIGNADO', 'ACEPTADO', 'EN_ARMADO', 'LISTO', 'ENVIADO', 'ENTREGADO'];

/**
 * Email al cliente por un cambio de estado. Usa la plantilla editable `ESTADO_<estado>` (tabla plantillas_email
 * o default); si el estado no tiene plantilla editable (p. ej. DEVUELTO) cae en la plantilla fija de código.
 * Devuelve el registro (o null si no corresponde email).
 */
export async function emailEstadoCliente(
  env: Env,
  p: PedidoParaEmail,
  estado: EstadoPedido,
  extra: { nota?: string | null } = {},
  db: Db = prisma,
) {
  const web = env.WEB_URL.replace(/\/$/, '');
  const enviado = await enviarPlantilla(
    env,
    {
      tipo: `ESTADO_${estado}`,
      para: p.email,
      vars: variablesPedido(env, p),
      ctaHref: `${web}/gracias/${p.id}`,
      extraHtml: extraPedidoHtml(p, { optica: ESTADOS_CON_OPTICA.includes(estado), nota: extra.nota }),
      pedidoId: p.id,
    },
    db,
  );
  if (enviado) return enviado;
  const t = plantillaEstado(env, p, estado, extra);
  if (!t) return null;
  return enviarEmail(env, { para: p.email, asunto: t.asunto, html: t.html }, { pedidoId: p.id, tipo: `ESTADO_${estado}` }, db);
}

/** Confirmación al crear el pedido (antes del pago). Con transferencia incluye CBU/alias y el plazo. */
export async function emailPedidoConfirmado(
  env: Env,
  p: PedidoParaEmail,
  opts: {
    metodoPago: 'MERCADO_PAGO' | 'MERCADO_PAGO_BILLETERA' | 'TRANSFERENCIA';
    transferencia?: { cbu: string | null; alias: string | null; titular: string | null; banco: string | null; horasReserva: number } | null;
  },
  db: Db = prisma,
) {
  const web = env.WEB_URL.replace(/\/$/, '');
  let extra = extraPedidoHtml(p);
  if (opts.metodoPago === 'TRANSFERENCIA' && opts.transferencia) {
    const t = opts.transferencia;
    const lineas = [
      t.titular ? `Titular: <strong>${escapar(t.titular)}</strong>` : null,
      t.banco ? `Banco: ${escapar(t.banco)}` : null,
      t.cbu ? `CBU: <strong>${escapar(t.cbu)}</strong>` : null,
      t.alias ? `Alias: <strong>${escapar(t.alias)}</strong>` : null,
      `Importe: <strong>${ars(dec(p.total) ?? 0)}</strong>`,
    ].filter(Boolean);
    extra += `<p style="margin:12px 0;padding:12px 14px;background:#F2F2F0;border-radius:8px">Transferí dentro de las próximas ${t.horasReserva} horas y subí el comprobante desde el link del pedido.<br>${lineas.join('<br>')}</p>`;
  } else if (opts.metodoPago !== 'TRANSFERENCIA') {
    extra += `<p style="margin:12px 0">Si todavía no terminaste el pago en Mercado Pago, podés retomarlo desde el link del pedido.</p>`;
  }
  return enviarPlantilla(
    env,
    { tipo: 'PEDIDO_CONFIRMADO', para: p.email, vars: variablesPedido(env, p), ctaHref: `${web}/gracias/${p.id}`, extraHtml: extra, pedidoId: p.id },
    db,
  );
}

/** Pago rechazado (Mercado Pago o transferencia rechazada por el admin). */
export async function emailPagoRechazado(env: Env, p: PedidoParaEmail, extra: { nota?: string | null } = {}, db: Db = prisma) {
  const web = env.WEB_URL.replace(/\/$/, '');
  return enviarPlantilla(
    env,
    { tipo: 'PAGO_RECHAZADO', para: p.email, vars: variablesPedido(env, p), ctaHref: `${web}/gracias/${p.id}`, extraHtml: extraPedidoHtml(p, { nota: extra.nota }), pedidoId: p.id },
    db,
  );
}

// ---------- Otros emails ----------

export async function emailOpticaNuevoPedido(
  env: Env,
  input: { pedido: PedidoParaEmail; optica: { email: string | null; nombre: string }; aceptarAntesDe: Date | null },
  db: Db = prisma,
) {
  if (!input.optica.email) return null;
  const web = env.WEB_URL.replace(/\/$/, '');
  const n = escapar(input.pedido.numero);
  const plazo = input.aceptarAntesDe
    ? ` Aceptalo antes del ${input.aceptarAntesDe.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' })} h; si no, pasa a otra óptica.`
    : '';
  const titulo = `Nuevo pedido asignado · ${n}`;
  const cuerpo = `<p>Hola ${escapar(input.optica.nombre)}, Vedere te asignó el pedido <strong>${n}</strong> (${input.pedido.modalidad === 'RETIRO_OPTICA' ? 'retiro en óptica' : 'envío a domicilio'}).${plazo}</p>${bloqueItems(input.pedido.items)}`;
  return enviarEmail(
    env,
    { para: input.optica.email, asunto: titulo, html: layoutEmail(env, { titulo, cuerpo, cta: { label: 'Ver el pedido', href: `${web}/optica/pedidos/${input.pedido.id}` } }) },
    { pedidoId: input.pedido.id, tipo: 'OPTICA_NUEVO_PEDIDO' },
    db,
  );
}

export async function emailAdmin(
  env: Env,
  input: { tipo: string; asunto: string; cuerpoHtml: string; pedidoId?: string | null; href?: string },
  db: Db = prisma,
) {
  const para = env.ADMIN_NOTIFY_EMAIL;
  if (!para) {
    return db.emailEnviado.create({
      data: { pedidoId: input.pedidoId ?? null, tipo: input.tipo, para: 'admin (sin ADMIN_NOTIFY_EMAIL)', asunto: input.asunto, estado: 'SIMULADO', proveedor: 'simulado' },
    });
  }
  const web = env.WEB_URL.replace(/\/$/, '');
  return enviarEmail(
    env,
    {
      para,
      asunto: input.asunto,
      html: layoutEmail(env, {
        titulo: input.asunto,
        cuerpo: input.cuerpoHtml,
        cta: { label: 'Abrir en el backoffice', href: input.href ?? `${web}/admin/pedidos${input.pedidoId ? `/${input.pedidoId}` : ''}` },
      }),
    },
    { pedidoId: input.pedidoId ?? null, tipo: input.tipo },
    db,
  );
}

export async function emailReembolso(env: Env, p: PedidoParaEmail, monto: number, motivo: string | null, db: Db = prisma) {
  const titulo = `Reintegro de ${ars(monto)} · Pedido ${escapar(p.numero)}`;
  const cuerpo = `<p>Hola ${escapar(p.nombre.split(' ')[0] || p.nombre)}, procesamos un reintegro de <strong>${ars(monto)}</strong> por tu pedido.${motivo ? ` Motivo: ${escapar(motivo)}.` : ''}</p><p>Según el medio de pago puede demorar hasta 10 días hábiles en verse reflejado.</p>`;
  return enviarEmail(env, { para: p.email, asunto: titulo, html: layoutEmail(env, { titulo, cuerpo }) }, { pedidoId: p.id, tipo: 'REEMBOLSO' }, db);
}

export async function emailSolicitud(
  env: Env,
  p: PedidoParaEmail,
  input: {
    tipo: 'CAMBIO' | 'DEVOLUCION';
    estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
    respuesta?: string | null;
    resolucion?: 'NUEVO_PEDIDO' | 'REINTEGRO' | null;
  },
  db: Db = prisma,
) {
  const que = input.tipo === 'CAMBIO' ? 'cambio' : 'devolución';
  const nombre = escapar(p.nombre.split(' ')[0] || p.nombre);
  let titulo: string;
  let cuerpo: string;
  if (input.estado === 'PENDIENTE') {
    titulo = `Recibimos tu solicitud de ${que} · ${escapar(p.numero)}`;
    cuerpo = `<p>Hola ${nombre}, recibimos tu solicitud de ${que}. La revisamos y te respondemos dentro de las próximas 48 h hábiles.</p>`;
  } else if (input.estado === 'APROBADA') {
    titulo = `Aprobamos tu ${que} · ${escapar(p.numero)}`;
    cuerpo =
      input.resolucion === 'NUEVO_PEDIDO'
        ? `<p>Hola ${nombre}, aprobamos tu ${que}: generamos un pedido nuevo sin cargo y te avisamos cuando esté listo.${input.respuesta ? ` ${escapar(input.respuesta)}` : ''}</p>`
        : `<p>Hola ${nombre}, aprobamos tu ${que}: te reintegramos el importe por el mismo medio de pago.${input.respuesta ? ` ${escapar(input.respuesta)}` : ''}</p>`;
  } else {
    titulo = `Sobre tu solicitud de ${que} · ${escapar(p.numero)}`;
    cuerpo = `<p>Hola ${nombre}, revisamos tu solicitud y no pudimos aprobarla.${input.respuesta ? ` ${escapar(input.respuesta)}` : ''} Si querés, respondé este email y lo vemos juntos.</p>`;
  }
  return enviarEmail(env, { para: p.email, asunto: titulo, html: layoutEmail(env, { titulo, cuerpo }) }, { pedidoId: p.id, tipo: `SOLICITUD_${input.estado}` }, db);
}
