import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, STAFF_ROLES } from '@/lib/session';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Ingresar' };
export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; denied?: string }>;
}) {
  const { next, denied } = await searchParams;
  const user = await getSession();
  if (user && STAFF_ROLES.includes(user.rol) && !denied) {
    redirect(next && next.startsWith('/admin') ? next : '/admin');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gris-claro/60 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-campaign text-4xl">
            Vedere
          </Link>
          <p className="mt-1 text-sm text-gris-medio">Backoffice</p>
        </div>
        <div className="rounded-2xl border border-negro/10 bg-blanco p-6 shadow-sm">
          {denied && (
            <p className="mb-4 rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">
              Tu usuario no tiene acceso al backoffice. Ingresá con una cuenta de administrador u
              operador.
            </p>
          )}
          <LoginForm next={next && next.startsWith('/admin') ? next : '/admin'} />
        </div>
      </div>
    </div>
  );
}
