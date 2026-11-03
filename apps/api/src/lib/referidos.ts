// Referidos (prompt 6): link único por cliente (/r/<codigo>); cuando un referido paga su primera compra,
// ambos reciben un cupón de descuento (ConfigTienda.referidoDescuentoPct) por email (REFERIDO_RECOMPENSA).
// Implementación en el agente de cuentas; este stub mantiene compilando post-pago.ts.
import type { Env } from '../env.js';
import type { PedidoFull } from './pedidos.js';

/** Si el pedido es la primera compra pagada de un usuario referido, emite los cupones y avisa a ambos. */
export async function recompensarReferido(pedido: PedidoFull, env: Env): Promise<void> {
  void pedido;
  void env;
}
