import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { buttonClasses } from '@vedere/ui';
import { serverApiOrNull } from '@/lib/api-server';
import { formatFecha, formatPrecio } from '@/lib/format';
import { labelEstadoCliente } from '@/lib/tienda/cuenta';
import type { PedidoCuenta } from '@/lib/tienda/cuenta';
import { Pastilla, SinDatos, Tarjeta } from '@/components/tienda/cuenta/Tarjeta';

export const metadata: Metadata = { title: 'Mis pedidos' };
export const dynamic = 'force-dynamic';

export default async function PedidosPage() {
  const data = await serverApiOrNull<{ items: PedidoCuenta[] }>('/cuenta/pedidos');
  const items = data?.items ?? [];

  return (
    <Tarjeta titulo="Mis pedidos">
      {items.length === 0 ? (
        <SinDatos>
          {data ? 'Todavía no tenés pedidos en esta cuenta.' : 'No pudimos cargar tus pedidos. Probá de nuevo en un momento.'}{' '}
          <Link href="/sol" className="underline underline-offset-4">
            Ver anteojos
          </Link>
        </SinDatos>
      ) : (
        <ul className="divide-y divide-negro/10" data-testid="cuenta-pedidos">
          {items.map((p) => {
            const fotos = p.items.filter((i) => i.imagen).slice(0, 3);
            const unidades = p.items.reduce((a, i) => a + i.cantidad, 0);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-4 py-4" data-testid="pedido-item">
                <div className="flex -space-x-3">
                  {fotos.length === 0 ? (
                    <span className="h-14 w-14 rounded-xl bg-gris-claro" />
                  ) : (
                    fotos.map((i) => (
                      <span key={i.id} className="relative h-14 w-14 overflow-hidden rounded-xl border-2 border-blanco bg-gris-claro">
                        <Image src={i.imagen!} alt="" fill sizes="56px" className="object-cover" />
                      </span>
                    ))
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold" data-testid="pedido-numero">
                    Pedido {p.numero}
                  </p>
                  <p className="text-sm text-gris-texto">
                    {formatFecha(p.createdAt)} · {unidades} producto{unidades === 1 ? '' : 's'} · {formatPrecio(p.totales.total)}
                    {p.numeroSeguimiento ? ` · seguimiento ${p.numeroSeguimiento}` : ''}
                  </p>
                </div>
                <Pastilla data-testid="pedido-estado">{labelEstadoCliente(p.estado, p.entrega.modalidad)}</Pastilla>
                <Link href={`/mi-cuenta/pedidos/${p.id}`} className={buttonClasses('secondary', 'sm')}>
                  Ver pedido
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}
