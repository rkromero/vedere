import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { OpticaShell } from '@/components/optica/OpticaShell';
import { requireOptica } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function OpticaShellLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const next = h.get('x-invoke-path') ?? '/optica';
  const user = await requireOptica(next);
  // Contraseña provisoria: primero tiene que elegir una nueva.
  if (user.debeCambiarPassword) redirect('/optica/cambiar-password');
  return <OpticaShell user={user}>{children}</OpticaShell>;
}
