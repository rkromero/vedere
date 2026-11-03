import Link from 'next/link';
import { buttonClasses } from '@vedere/ui';
import { serverApiOrNull } from '@/lib/api-server';
import { formatFecha } from '@/lib/format';
import { labelEstadoCliente } from '@/lib/tienda/cuenta';
import type { PedidoCuenta, ResumenCuenta } from '@/lib/tienda/cuenta';
import { Tarjeta, SinDatos } from '@/components/tienda/cuenta/Tarjeta';
import { PlanRivedere } from '@/components/tienda/cuenta/PlanRivedere';

export const dynamic = 'force-dynamic';

export default async function ResumenPage() {
  const [resumen, pedidos] = await Promise.all([
    serverApiOrNull<ResumenCuenta>('/cuenta'),
    serverApiOrNull<{ items: PedidoCuenta[] }>('/cuenta/pedidos'),
  ]);
  const ultimos = (pedidos?.items ?? []).slice(0, 3);
  const n = resumen?.resumen;

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Acceso href="/mi-cuenta/pedidos" label="Pedidos" valor={n?.pedidos} />
        <Acceso href="/mi-cuenta/recetas" label="Recetas guardadas" valor={n?.recetas} />
        <Acceso href="/mi-cuenta/direcciones" label="Direcciones" valor={n?.direcciones} />
        <Acceso href="/mi-cuenta/favoritos" label="Favoritos" valor={n?.favoritos} />
      </div>

      <Tarjeta
        titulo="Últimos pedidos"
        accion={
          ultimos.length > 0 ? (
            <Link href="/mi-cuenta/pedidos" className="text-sm underline underline-offset-4">
              Ver todos
            </Link>
          ) : null
        }
      >
        {ultimos.length === 0 ? (
          <SinDatos>
            Todavía no tenés pedidos.{' '}
            <Link href="/sol" className="underline underline-offset-4">
              Mirá los anteojos de sol
            </Link>{' '}
            o{' '}
            <Link href="/recetados" className="underline underline-offset-4">
              los recetados
            </Link>
            .
          </SinDatos>
        ) : (
          <ul className="divide-y divide-negro/10">
            {ultimos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3" data-testid="pedido-item">
                <div>
                  <Link href={`/mi-cuenta/pedidos/${p.id}`} className="font-semibold underline-offset-4 hover:underline">
                    Pedido {p.numero}
                  </Link>
                  <p className="text-sm text-gris-texto">
                    {formatFecha(p.createdAt)} · {p.items.reduce((a, i) => a + i.cantidad, 0)} producto(s)
                  </p>
                </div>
                <span className="rounded-full bg-gris-claro px-3 py-1 text-sm">
                  {labelEstadoCliente(p.estado, p.entrega.modalidad)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <PlanRivedere rivedere={resumen?.rivedere ?? null} />

      <Tarjeta titulo="Referidos">
        <p className="text-sm text-negro/80">
          Compartí tu link con amigos: cuando uno hace su primera compra, los dos reciben un cupón de descuento.
        </p>
        <Link href="/mi-cuenta/referidos" className={buttonClasses('secondary', 'sm', 'mt-4')}>
          Ver mi link de referidos
        </Link>
      </Tarjeta>
    </div>
  );
}

function Acceso({ href, label, valor }: { href: string; label: string; valor: number | undefined }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-negro/10 p-4 transition-colors hover:border-negro/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche"
    >
      <p className="font-campaign text-4xl">{valor ?? '—'}</p>
      <p className="mt-1 text-sm text-gris-texto">{label}</p>
    </Link>
  );
}
