import type { Metadata } from 'next';
import { UsuariosOptica } from '@/components/optica/UsuariosOptica';
import type { UsuarioOptica } from '@/components/optica/UsuariosOptica';
import { serverApi } from '@/lib/api-server';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Usuarios' };
export const dynamic = 'force-dynamic';

export default async function UsuariosOpticaPage() {
  const [data, user] = await Promise.all([
    serverApi<{ items: UsuarioOptica[]; puedeAdministrar: boolean }>('/optica/usuarios'),
    getSession(),
  ]);
  return <UsuariosOptica usuarios={data.items} puedeAdministrar={data.puedeAdministrar} yoId={user?.id ?? ''} />;
}
