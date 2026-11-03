import type { Metadata } from 'next';
import { TurnosAgenda } from '@/components/optica/TurnosAgenda';
import { qs, serverApi } from '@/lib/api-server';
import type { Turno } from '@/lib/pedidos';

export const metadata: Metadata = { title: 'Agenda de turnos' };
export const dynamic = 'force-dynamic';

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = await serverApi<{ items: Turno[] }>(`/optica/turnos${qs({ estado: sp.estado, desde: sp.desde, hasta: sp.hasta })}`);
  const prefill = {
    pedidoId: typeof sp.pedidoId === 'string' ? sp.pedidoId : '',
    nombre: typeof sp.nombre === 'string' ? sp.nombre : '',
    telefono: typeof sp.telefono === 'string' ? sp.telefono : '',
  };
  return <TurnosAgenda turnos={data.items} prefill={prefill} />;
}
