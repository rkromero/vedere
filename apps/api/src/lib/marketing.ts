// Conversiones server-side (prompt 6): Meta Conversions API (META_PIXEL_ID + META_CAPI_TOKEN) y GA4
// Measurement Protocol (GA4_MEASUREMENT_ID + GA4_API_SECRET). El event_id `purchase-<pedidoId>` coincide con
// el que manda el navegador (lib/analytics.ts en la web) para deduplicar. Implementación en el agente de
// comunicaciones/marketing; este stub mantiene compilando post-pago.ts.
import type { Env } from '../env.js';
import type { PedidoFull } from './pedidos.js';

export function eventIdCompra(pedidoId: string): string {
  return `purchase-${pedidoId}`;
}

/** Envía el evento Purchase a Meta CAPI y GA4 MP (si están configurados). Nunca lanza. */
export async function enviarConversionCompra(pedido: PedidoFull, env: Env): Promise<void> {
  void pedido;
  void env;
}
