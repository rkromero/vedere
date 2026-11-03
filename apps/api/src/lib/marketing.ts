// Conversiones server-side (prompt 6): Meta Conversions API (META_PIXEL_ID + META_CAPI_TOKEN) y GA4
// Measurement Protocol (GA4_MEASUREMENT_ID + GA4_API_SECRET). El event_id `purchase-<pedidoId>` coincide con
// el que manda el navegador (lib/analytics.ts en la web) para deduplicar el Purchase del Pixel.
// Ambos son opcionales por env; los errores se registran y nunca frenan el pedido.
import { createHash } from 'node:crypto';
import type { Env } from '../env.js';
import type { PedidoFull } from './pedidos.js';
import { dec } from './serialize.js';

const TIMEOUT_MS = 5000;
const META_API = 'https://graph.facebook.com/v21.0';
const GA4_API = 'https://www.google-analytics.com/mp/collect';

export function eventIdCompra(pedidoId: string): string {
  return `purchase-${pedidoId}`;
}

/** sha256 en hex de un valor normalizado (minúsculas, sin espacios); Meta exige hashear email/teléfono. */
export function hashMeta(v: string | null | undefined): string | null {
  const n = (v ?? '').trim().toLowerCase();
  if (!n) return null;
  return createHash('sha256').update(n).digest('hex');
}

/** Teléfono en formato E.164 sin "+" (sólo dígitos; agrega 54 si parece argentino sin código de país). */
export function normalizarTelefono(t: string | null | undefined): string | null {
  const d = (t ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('54')) return d;
  return d.length <= 11 ? `54${d.replace(/^0/, '')}` : d;
}

export function payloadMeta(pedido: PedidoFull, env: Env, ahora = new Date()) {
  const web = env.WEB_URL.replace(/\/$/, '');
  const total = dec(pedido.total) ?? 0;
  const userData: Record<string, string[]> = {};
  const em = hashMeta(pedido.email);
  const ph = hashMeta(normalizarTelefono(pedido.telefono));
  const ext = hashMeta(pedido.userId ?? pedido.email);
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (ext) userData.external_id = [ext];
  const nombre = pedido.nombre.trim().split(/\s+/);
  const fn = hashMeta(nombre[0]);
  const ln = hashMeta(nombre.slice(1).join(' '));
  if (fn) userData.fn = [fn];
  if (ln) userData.ln = [ln];
  userData.country = [hashMeta('ar')!];

  return {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(ahora.getTime() / 1000),
        event_id: eventIdCompra(pedido.id),
        action_source: 'website',
        event_source_url: `${web}/gracias/${pedido.id}`,
        user_data: userData,
        custom_data: {
          currency: 'ARS',
          value: total,
          order_id: pedido.numero,
          content_type: 'product',
          content_ids: pedido.items.map((i) => i.sku),
          contents: pedido.items.map((i) => ({ id: i.sku, quantity: i.cantidad, item_price: dec(i.precioUnitario) ?? 0 })),
          num_items: pedido.items.reduce((a, i) => a + i.cantidad, 0),
        },
      },
    ],
    ...(env.META_TEST_EVENT_CODE ? { test_event_code: env.META_TEST_EVENT_CODE } : {}),
  };
}

export function payloadGa4(pedido: PedidoFull) {
  const total = dec(pedido.total) ?? 0;
  return {
    client_id: pedido.userId ?? pedido.id,
    non_personalized_ads: false,
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: pedido.numero,
          value: total,
          currency: 'ARS',
          shipping: dec(pedido.envio) ?? 0,
          ...(pedido.cuponCodigo ? { coupon: pedido.cuponCodigo } : {}),
          items: pedido.items.map((i) => ({
            item_id: i.sku,
            item_name: i.nombre,
            item_variant: i.color,
            item_category: i.linea,
            price: dec(i.precioUnitario) ?? 0,
            quantity: i.cantidad,
            ...(i.descuento && (dec(i.descuento) ?? 0) > 0 ? { discount: (dec(i.descuento) ?? 0) / i.cantidad } : {}),
          })),
        },
      },
    ],
  };
}

async function post(url: string, body: unknown): Promise<{ ok: boolean; status: number; texto: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { ok: res.ok, status: res.status, texto: await res.text().catch(() => '') };
}

export interface ResultadoConversion {
  meta: 'ENVIADO' | 'ERROR' | 'OMITIDO';
  ga4: 'ENVIADO' | 'ERROR' | 'OMITIDO';
  errores: string[];
}

/** Envía el evento Purchase a Meta CAPI y GA4 MP (si están configurados). Nunca lanza. */
export async function enviarConversionCompra(pedido: PedidoFull, env: Env): Promise<ResultadoConversion> {
  const r: ResultadoConversion = { meta: 'OMITIDO', ga4: 'OMITIDO', errores: [] };
  if (env.META_PIXEL_ID && env.META_CAPI_TOKEN) {
    try {
      const url = `${META_API}/${encodeURIComponent(env.META_PIXEL_ID)}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`;
      const res = await post(url, payloadMeta(pedido, env));
      r.meta = res.ok ? 'ENVIADO' : 'ERROR';
      if (!res.ok) r.errores.push(`meta HTTP ${res.status}: ${res.texto.slice(0, 200)}`);
    } catch (err) {
      r.meta = 'ERROR';
      r.errores.push(`meta: ${err instanceof Error ? err.message : 'error'}`);
    }
  }
  if (env.GA4_MEASUREMENT_ID && env.GA4_API_SECRET) {
    try {
      const url = `${GA4_API}?measurement_id=${encodeURIComponent(env.GA4_MEASUREMENT_ID)}&api_secret=${encodeURIComponent(env.GA4_API_SECRET)}`;
      const res = await post(url, payloadGa4(pedido));
      r.ga4 = res.ok ? 'ENVIADO' : 'ERROR';
      if (!res.ok) r.errores.push(`ga4 HTTP ${res.status}: ${res.texto.slice(0, 200)}`);
    } catch (err) {
      r.ga4 = 'ERROR';
      r.errores.push(`ga4: ${err instanceof Error ? err.message : 'error'}`);
    }
  }
  return r;
}
