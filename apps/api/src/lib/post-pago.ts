// Ganchos que corren después de aprobarse el pago de un pedido (prompt 6): recompensa de referidos y
// conversión server-side (Meta Conversions API / GA4 Measurement Protocol). Cada gancho es independiente y
// nunca frena el pedido: los errores se registran y se siguen ejecutando los demás.
import type { Env } from '../env.js';
import type { PedidoFull } from './pedidos.js';
import { recompensarReferido } from './referidos.js';
import { enviarConversionCompra } from './marketing.js';

type Gancho = { nombre: string; fn: (pedido: PedidoFull, env: Env) => Promise<unknown> };

const GANCHOS: Gancho[] = [
  { nombre: 'referidos', fn: recompensarReferido },
  { nombre: 'conversion', fn: enviarConversionCompra },
];

export async function ejecutarPostPago(pedido: PedidoFull, env: Env, log?: { warn: (o: unknown, m?: string) => void }) {
  for (const g of GANCHOS) {
    try {
      await g.fn(pedido, env);
    } catch (err) {
      log?.warn({ err, gancho: g.nombre, pedidoId: pedido.id }, 'post-pago: gancho falló');
    }
  }
}
