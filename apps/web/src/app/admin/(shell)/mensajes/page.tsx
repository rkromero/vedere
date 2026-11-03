import type { Metadata } from 'next';
import { serverApi, qs } from '@/lib/api-server';
import type { AvisoStock, MensajeContacto, Paged, SuscripcionNewsletter } from '@/lib/types';
import { MensajesView } from '@/components/admin/tienda/MensajesView';
import type { Bandeja } from '@/components/admin/tienda/MensajesView';

export const metadata: Metadata = { title: 'Mensajes' };
export const dynamic = 'force-dynamic';

export default async function MensajesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === 'avisos' || sp.tab === 'newsletter' ? sp.tab : 'contacto';
  const base = { q: sp.q, page: sp.page, pageSize: '20' };

  if (tab === 'contacto') {
    const data = await serverApi<Paged<MensajeContacto> & { sinLeer: number }>(
      `/admin/contacto${qs({ ...base, motivo: sp.motivo, leido: sp.leido })}`,
    );
    const bandeja: Bandeja = { tab, data, sinLeer: data.sinLeer };
    return <MensajesView bandeja={bandeja} />;
  }

  const sinLeerData = await serverApi<{ sinLeer: number }>('/admin/contacto?pageSize=1');
  if (tab === 'avisos') {
    const data = await serverApi<Paged<AvisoStock>>(`/admin/avisos-stock${qs(base)}`);
    const bandeja: Bandeja = { tab, data, sinLeer: sinLeerData.sinLeer };
    return <MensajesView bandeja={bandeja} />;
  }
  const data = await serverApi<Paged<SuscripcionNewsletter>>(`/admin/newsletter${qs(base)}`);
  const bandeja: Bandeja = { tab, data, sinLeer: sinLeerData.sinLeer };
  return <MensajesView bandeja={bandeja} />;
}
