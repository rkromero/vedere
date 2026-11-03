// Cliente mínimo de Mercado Pago (Checkout Pro) sin SDK: preferencias, consulta de pagos y
// verificación de la firma de los webhooks. Las credenciales viven sólo en el entorno.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Env } from '../env.js';
import { AppError } from './errors.js';

const API = 'https://api.mercadopago.com';

export interface MpConfig {
  accessToken: string;
  webhookSecret: string | null;
}

/** Credenciales de Mercado Pago, o null si no están configuradas (la integración queda apagada). */
export function mpConfig(env: Env): MpConfig | null {
  if (!env.MP_ACCESS_TOKEN) return null;
  return { accessToken: env.MP_ACCESS_TOKEN, webhookSecret: env.MP_WEBHOOK_SECRET ?? null };
}

export function mpHabilitado(env: Env): boolean {
  return env.MP_ENABLED && mpConfig(env) !== null;
}

export interface PreferenciaItem {
  id: string;
  title: string;
  description?: string;
  picture_url?: string;
  category_id?: string;
  quantity: number;
  unit_price: number;
  currency_id: 'ARS';
}

export interface PreferenciaInput {
  /** id del pedido: viaja como external_reference y como clave de idempotencia. */
  pedidoId: string;
  numero: string;
  items: PreferenciaItem[];
  /** Si el total con descuentos difiere de la suma de ítems, se manda un ítem de ajuste negativo no permitido → usamos un único ítem resumen. */
  total: number;
  pagador: { email: string; nombre: string; dni: string; telefono: string };
  cuotas: number;
  backUrls: { success: string; pending: string; failure: string };
  notificationUrl: string;
  /** Pago con billetera / QR de la app (purpose wallet_purchase: exige cuenta de MP). */
  billetera?: boolean;
  /** Vencimiento de la preferencia (coincide con la reserva de stock). */
  expiraEn: Date;
}

export interface Preferencia {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

async function mpFetch<T>(cfg: MpConfig, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as T & { message?: string; error?: string };
  if (!res.ok) {
    const msg = body?.message ?? body?.error ?? `HTTP ${res.status}`;
    throw new AppError(502, 'MP_ERROR', `Mercado Pago respondió con un error: ${msg}`);
  }
  return body;
}

/** Crea la preferencia de Checkout Pro. Idempotente por pedido (X-Idempotency-Key). */
export async function crearPreferencia(cfg: MpConfig, input: PreferenciaInput): Promise<Preferencia> {
  const [nombre, ...apellido] = input.pagador.nombre.trim().split(/\s+/);
  const telefono = input.pagador.telefono.replace(/\D/g, '');
  const payload = {
    external_reference: input.pedidoId,
    items: input.items,
    payer: {
      email: input.pagador.email,
      name: nombre,
      surname: apellido.join(' ') || undefined,
      identification: { type: 'DNI', number: input.pagador.dni },
      phone: telefono ? { area_code: '', number: telefono } : undefined,
    },
    payment_methods: {
      installments: input.cuotas,
      excluded_payment_types: [{ id: 'ticket' }],
    },
    back_urls: input.backUrls,
    auto_return: 'approved',
    notification_url: input.notificationUrl,
    statement_descriptor: 'VEDERE',
    binary_mode: false,
    expires: true,
    expiration_date_from: new Date().toISOString(),
    expiration_date_to: input.expiraEn.toISOString(),
    metadata: { pedido_id: input.pedidoId, numero: input.numero },
    ...(input.billetera ? { purpose: 'wallet_purchase' } : {}),
  };
  return mpFetch<Preferencia>(cfg, '/checkout/preferences', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': `pref-${input.pedidoId}` },
    body: JSON.stringify(payload),
  });
}

export type MpPaymentStatus =
  | 'pending'
  | 'approved'
  | 'authorized'
  | 'in_process'
  | 'in_mediation'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back';

export interface MpPayment {
  id: number;
  status: MpPaymentStatus;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  installments?: number;
  payment_method_id?: string;
  payment_type_id?: string;
  date_approved?: string | null;
  payer?: { email?: string };
  metadata?: Record<string, unknown>;
}

export async function obtenerPago(cfg: MpConfig, paymentId: string): Promise<MpPayment> {
  return mpFetch<MpPayment>(cfg, `/v1/payments/${encodeURIComponent(paymentId)}`);
}

/** Mapea el estado de Mercado Pago al estado de pago del pedido. */
export function mapearEstado(status: MpPaymentStatus): 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'REEMBOLSADO' {
  switch (status) {
    case 'approved':
      return 'APROBADO';
    case 'rejected':
    case 'cancelled':
      return 'RECHAZADO';
    case 'refunded':
    case 'charged_back':
      return 'REEMBOLSADO';
    default:
      return 'PENDIENTE';
  }
}

/**
 * Verifica la firma del webhook (header x-signature: "ts=...,v1=...").
 * Manifiesto oficial: `id:{data.id};request-id:{x-request-id};ts:{ts};` → HMAC-SHA256 con la clave secreta.
 */
export function verificarFirma(input: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
  secret: string;
  /** Tolerancia en segundos para el timestamp (anti-replay). 0 = sin control. */
  toleranciaSeg?: number;
  ahora?: number;
}): boolean {
  if (!input.xSignature || !input.dataId) return false;
  const partes = Object.fromEntries(
    input.xSignature.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=');
      return [k?.trim(), v.join('=').trim()];
    }),
  ) as Record<string, string>;
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;
  const tolerancia = input.toleranciaSeg ?? 0;
  if (tolerancia > 0) {
    const ahora = input.ahora ?? Date.now();
    const tsMs = Number(ts) * (ts.length > 11 ? 1 : 1000);
    if (!Number.isFinite(tsMs) || Math.abs(ahora - tsMs) > tolerancia * 1000) return false;
  }
  // data.id alfanumérico se compara en minúsculas (así lo firma MP).
  const dataId = /^[0-9]+$/.test(input.dataId) ? input.dataId : input.dataId.toLowerCase();
  const manifiesto = `id:${dataId};${input.xRequestId ? `request-id:${input.xRequestId};` : ''}ts:${ts};`;
  const esperado = createHmac('sha256', input.secret).update(manifiesto).digest('hex');
  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Firma un webhook (para tests y simulaciones). */
export function firmarWebhook(input: { dataId: string; xRequestId: string; secret: string; ts?: number }): string {
  const ts = input.ts ?? Math.floor(Date.now() / 1000);
  const dataId = /^[0-9]+$/.test(input.dataId) ? input.dataId : input.dataId.toLowerCase();
  const manifiesto = `id:${dataId};request-id:${input.xRequestId};ts:${ts};`;
  const v1 = createHmac('sha256', input.secret).update(manifiesto).digest('hex');
  return `ts=${ts},v1=${v1}`;
}
