import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/app/admin/login/LoginForm';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Ingresar' };
export const dynamic = 'force-dynamic';

export default async function OpticaLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; denied?: string }>;
}) {
  const { next, denied } = await searchParams;
  const user = await getSession();
  const destino = next && next.startsWith('/optica') ? next : '/optica';
  if (user && user.rol === 'OPTICA' && user.opticaId && !denied) redirect(destino);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gris-claro/60 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-campaign text-4xl">
            Vedere
          </Link>
          <p className="mt-1 text-sm text-gris-medio">Panel de ópticas socias</p>
        </div>
        <div className="rounded-2xl border border-negro/10 bg-blanco p-6 shadow-sm">
          {denied && (
            <p className="mb-4 rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">
              Este panel es para usuarios de ópticas socias. Si sos del equipo Vedere, entrá por{' '}
              <Link href="/admin/login" className="underline">
                el backoffice
              </Link>
              .
            </p>
          )}
          <LoginForm
            next={destino}
            roles={['OPTICA']}
            mensajeDenegado="Tu usuario no pertenece a una óptica socia."
          />
        </div>
        <p className="mt-6 text-center text-xs text-gris-medio">
          ¿Querés sumar tu óptica a la red?{' '}
          <Link href="/opticas/sumate" className="underline underline-offset-2">
            Escribinos
          </Link>
        </p>
      </div>
    </div>
  );
}
