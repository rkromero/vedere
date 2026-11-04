import type { Metadata } from 'next';
import { CarritoMayoristaView } from '@/components/optica/mayorista/CarritoMayoristaView';
import { serverApi } from '@/lib/api-server';
import type { CarritoMayorista } from '@/lib/mayorista';

export const metadata: Metadata = { title: 'Carrito mayorista' };
export const dynamic = 'force-dynamic';

export default async function CarritoMayoristaPage() {
  const carrito = await serverApi<CarritoMayorista>('/optica/mayorista/carrito');
  return <CarritoMayoristaView inicial={carrito} />;
}
