import type { Metadata } from 'next';
import { UsuariosTable } from '@/components/admin/usuarios/UsuariosTable';
import { PageHeader } from '@/components/admin/ui';
import { qs, serverApi } from '@/lib/api-server';
import { requireAdmin } from '@/lib/session';
import type { OpticaAdmin, Paged, Usuario } from '@/lib/types';

export const metadata: Metadata = { title: 'Usuarios' };
export const dynamic = 'force-dynamic';

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdmin('/admin/usuarios');
  const sp = await searchParams;
  const [data, opticas] = await Promise.all([
    serverApi<Paged<Usuario>>(
      `/admin/usuarios${qs({ q: sp.q, rol: sp.rol, activo: sp.activo, page: sp.page, pageSize: '20' })}`,
    ),
    serverApi<Paged<OpticaAdmin>>('/admin/opticas?pageSize=100'),
  ]);

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Cuentas del equipo, ópticas y clientes. Sólo los administradores pueden gestionarlas."
      />
      <UsuariosTable
        data={data}
        currentUserId={user.id}
        opticas={opticas.items.map((o) => ({ id: o.id, nombre: o.nombre, activa: o.activa }))}
      />
    </>
  );
}
