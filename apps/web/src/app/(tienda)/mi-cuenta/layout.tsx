import type { Metadata } from 'next';
import { Container } from '@vedere/ui';
import { requireCliente } from '@/lib/session';
import { nombreCorto } from '@/lib/tienda/cuenta';
import { CuentaNav } from '@/components/tienda/cuenta/CuentaNav';

export const metadata: Metadata = {
  title: { default: 'Mi cuenta', template: '%s · Mi cuenta | Vedere' },
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

/** Layout de Mi cuenta: exige sesión (cualquier rol) y muestra la navegación de secciones. */
export default async function MiCuentaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCliente('/mi-cuenta');
  const panel =
    user.rol === 'ADMIN' || user.rol === 'OPERADOR'
      ? { href: '/admin', label: 'Ir al backoffice' }
      : user.rol === 'OPTICA'
        ? { href: '/optica', label: 'Panel de mi óptica' }
        : null;

  return (
    <>
      <section className="bg-gris-claro">
        <Container className="py-8 md:py-12">
          <p className="font-text text-sm uppercase tracking-wide text-gris-texto">Mi cuenta</p>
          <h1 className="font-campaign mt-1 text-4xl md:text-6xl">Hola, {nombreCorto(user.nombre)}</h1>
        </Container>
      </section>
      <Container className="py-8 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[14rem_1fr] lg:gap-12">
          <CuentaNav panel={panel} />
          <div className="font-text min-w-0">{children}</div>
        </div>
      </Container>
    </>
  );
}
