import type { Metadata } from 'next';
import { IconWhatsApp } from '@vedere/ui';
import { site, whatsappLink } from '@/config/site';
import { ContactoForm } from '@/components/tienda/ContactoForm';
import { MOTIVOS } from '@/lib/tienda/contacto';
import { Pagina } from '@/components/tienda/Pagina';

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Escribinos: consultas, turnos para multifocales, cambios y devoluciones.',
  alternates: { canonical: '/contacto' },
};

export default async function ContactoPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const inicial = MOTIVOS.find((m) => m.value === (motivo ?? '').toUpperCase())?.value;
  const wa = whatsappLink('Hola Vedere, tengo una consulta');
  return (
    <Pagina
      titulo={inicial === 'TURNO' ? 'Pedí tu turno' : 'Contacto'}
      intro={
        inicial === 'TURNO'
          ? 'Dejanos tus datos y te llamamos para coordinar un turno en la óptica socia más cercana. Sin apuro y sin compromiso.'
          : 'Respondemos dentro de las 24 horas hábiles. Si es urgente, escribinos por WhatsApp.'
      }
      aside={
        <div className="space-y-5 rounded-3xl bg-gris-claro p-6">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#25D366] px-5 font-medium text-negro"
            >
              <IconWhatsApp /> WhatsApp
            </a>
          )}
          <p>
            <span className="block text-sm text-gris-texto">Email</span>
            <a href={`mailto:${site.emailContacto}`} className="underline underline-offset-4">
              {site.emailContacto}
            </a>
          </p>
          <p>
            <span className="block text-sm text-gris-texto">Horario</span>
            Lunes a viernes de 9 a 18 h.
          </p>
        </div>
      }
    >
      <ContactoForm motivoInicial={inicial} />
    </Pagina>
  );
}
