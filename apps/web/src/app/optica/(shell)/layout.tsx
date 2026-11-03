import { headers } from 'next/headers';
import { OpticaShell } from '@/components/optica/OpticaShell';
import { requireOptica } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function OpticaShellLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const next = h.get('x-invoke-path') ?? '/optica';
  const user = await requireOptica(next);
  return <OpticaShell user={user}>{children}</OpticaShell>;
}
