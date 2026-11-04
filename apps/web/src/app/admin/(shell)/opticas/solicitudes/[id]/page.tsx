import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SolicitudOpticaDetalle } from '@/components/admin/opticas/SolicitudOpticaDetalle';
import { serverApiOrNull } from '@/lib/api-server';
import type { SolicitudOpticaDetalle as Detalle } from '@/lib/types';

export const metadata: Metadata = { title: 'Solicitud de óptica' };
export const dynamic = 'force-dynamic';

export default async function SolicitudOpticaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await serverApiOrNull<Detalle>(`/admin/opticas/solicitudes/${id}`);
  if (!s) notFound();
  return <SolicitudOpticaDetalle solicitud={s} />;
}
