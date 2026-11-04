import type { Metadata } from 'next';
import Link from 'next/link';
import { CambiarPasswordForm } from '@/components/optica/CambiarPasswordForm';
import { requireOptica } from '@/lib/session';

export const metadata: Metadata = { title: 'Elegí tu contraseña' };
export const dynamic = 'force-dynamic';

/** Primer ingreso con contraseña provisoria (obligatorio) o cambio voluntario desde el panel. */
export default async function CambiarPasswordPage() {
  const user = await requireOptica('/optica/cambiar-password');
  const obligatorio = !!user.debeCambiarPassword;
  return (
    <div className="flex min-h-screen items-center justify-center bg-gris-claro/60 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-campaign text-4xl">
            Vedere
          </Link>
          <p className="mt-1 text-sm text-gris-medio">{user.optica?.nombre ?? 'Panel de ópticas socias'}</p>
        </div>
        <div className="rounded-2xl border border-negro/10 bg-blanco p-6 shadow-sm">
          <h1 className="text-lg font-semibold">{obligatorio ? 'Elegí tu contraseña' : 'Cambiar contraseña'}</h1>
          <p className="mb-5 mt-1 text-sm text-gris-medio">
            {obligatorio
              ? `Hola ${user.nombre.split(' ')[0]}, estás usando una contraseña provisoria. Elegí una nueva para entrar al panel.`
              : 'Ingresá tu contraseña actual y la nueva.'}
          </p>
          <CambiarPasswordForm obligatorio={obligatorio} />
        </div>
        {!obligatorio && (
          <p className="mt-6 text-center text-xs text-gris-medio">
            <Link href="/optica" className="underline underline-offset-2">
              Volver al panel
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
