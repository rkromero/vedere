import type { Metadata } from 'next';
import Link from 'next/link';
import { Pagina } from '@/components/tienda/Pagina';
import { BuscarPedido } from '@/components/tienda/checkout/BuscarPedido';

export const metadata: Metadata = {
  title: 'Seguí tu pedido',
  description: 'Consultá el estado de tu pedido Vedere con el número y el email de la compra.',
  alternates: { canonical: '/pedido' },
};

export default async function PedidoPage({ searchParams }: { searchParams: Promise<{ numero?: string }> }) {
  const { numero } = await searchParams;
  return (
    <Pagina
      titulo="Seguí tu pedido"
      intro="Ingresá el número de pedido y el email con el que compraste. Si tenés cuenta, lo ves con más detalle en Mi cuenta."
      ancho="full"
      aside={
        <div className="space-y-3 rounded-3xl bg-gris-claro p-6 text-sm">
          <p className="font-semibold">¿Tenés cuenta?</p>
          <p className="text-gris-texto">Tus pedidos, recetas y direcciones quedan guardados.</p>
          <Link href="/mi-cuenta/pedidos" className="inline-block underline underline-offset-4">
            Ir a Mi cuenta
          </Link>
          <p className="pt-3 font-semibold">¿Querés cambiarlo?</p>
          <Link href="/cambios-y-devoluciones" className="inline-block underline underline-offset-4">
            Cambios y devoluciones
          </Link>
        </div>
      }
    >
      <BuscarPedido numeroInicial={numero ?? ''} />
    </Pagina>
  );
}
