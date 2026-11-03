import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@vedere/ui';
import { Pagina } from '@/components/tienda/Pagina';
import { NewsletterBaja } from '@/components/tienda/legal/NewsletterBaja';
import { publicApi, PublicApiError } from '@/lib/tienda/api';

export const metadata: Metadata = { title: 'Baja del newsletter', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

interface Suscripcion {
  email: string;
  activa: boolean;
}

async function getSuscripcion(token: string): Promise<Suscripcion | null | 'error'> {
  try {
    return await publicApi<Suscripcion>(`/sitio/newsletter/baja/${encodeURIComponent(token)}`, { revalidate: 0 });
  } catch (err) {
    return err instanceof PublicApiError && err.status === 404 ? null : 'error';
  }
}

export default async function NewsletterBajaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await getSuscripcion(token);
  return (
    <Pagina titulo="Baja del newsletter" intro="Un click y listo. Sin preguntas.">
      {s === 'error' ? (
        <p className="font-text rounded-3xl bg-sol/30 p-6">
          No pudimos consultar tu suscripción en este momento. Probá de nuevo en unos minutos o escribinos a{' '}
          <Link href="/contacto" className="underline underline-offset-4">
            contacto
          </Link>
          .
        </p>
      ) : s === null ? (
        <div className="font-text rounded-3xl bg-gris-claro p-6">
          <p>Este link de baja no es válido o ya fue usado.</p>
          <Link href="/" className={buttonClasses('primary', 'md', 'mt-5')}>
            Volver a la tienda
          </Link>
        </div>
      ) : (
        <NewsletterBaja token={token} email={s.email} activa={s.activa} />
      )}
    </Pagina>
  );
}
