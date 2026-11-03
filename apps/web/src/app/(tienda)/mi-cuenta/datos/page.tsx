import type { Metadata } from 'next';
import { serverApiOrNull } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import type { ResumenCuenta, UsuarioCuenta } from '@/lib/tienda/cuenta';
import { Tarjeta } from '@/components/tienda/cuenta/Tarjeta';
import { DatosForm, PasswordForm } from '@/components/tienda/cuenta/DatosForm';

export const metadata: Metadata = { title: 'Mis datos' };
export const dynamic = 'force-dynamic';

export default async function DatosPage() {
  const [resumen, sesion] = await Promise.all([serverApiOrNull<ResumenCuenta>('/cuenta'), getSession()]);
  // Si /cuenta no responde (API vieja), armamos los datos desde la sesión.
  const user: UsuarioCuenta | null =
    resumen?.user ??
    (sesion
      ? {
          id: sesion.id,
          email: sesion.email,
          nombre: sesion.nombre,
          telefono: sesion.telefono,
          rol: sesion.rol,
          createdAt: sesion.createdAt,
          googleVinculado: false,
          newsletter: false,
          codigoReferido: null,
        }
      : null);
  if (!user) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Tarjeta titulo="Mis datos">
        <DatosForm user={user} />
      </Tarjeta>
      <Tarjeta titulo="Contraseña">
        <PasswordForm googleVinculado={user.googleVinculado} />
      </Tarjeta>
    </div>
  );
}
