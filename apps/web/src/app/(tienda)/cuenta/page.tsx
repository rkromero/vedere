import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@vedere/ui';
import { getSession } from '@/lib/session';
import { Pagina, Prose } from '@/components/tienda/Pagina';

export const metadata: Metadata = {
  title: 'Mi cuenta',
  robots: { index: false },
};
export const dynamic = 'force-dynamic';

export default async function CuentaPage() {
  const user = await getSession();
  return (
    <Pagina
      titulo={user ? `Hola, ${user.nombre.split(' ')[0]}` : 'Mi cuenta'}
      intro={
        user
          ? 'Tu carrito se sincroniza con tu cuenta en todos tus dispositivos.'
          : 'Las cuentas de clientes llegan en el próximo paso. Mientras tanto, tu carrito se guarda en este dispositivo.'
      }
    >
      <Prose>
        {user ? (
          <p>
            Sesión iniciada como <strong>{user.email}</strong>.
            {user.rol === 'ADMIN' || user.rol === 'OPERADOR' ? (
              <>
                {' '}
                <Link href="/admin">Ir al backoffice</Link>.
              </>
            ) : null}
          </p>
        ) : (
          <p>
            Podés comprar sin cuenta. Si querés seguir un pedido o hacer un cambio,{' '}
            <Link href="/contacto">escribinos</Link> con tu número de pedido.
          </p>
        )}
      </Prose>
      <Link href="/sol" className={buttonClasses('primary', 'md', 'mt-8')}>
        Seguir comprando
      </Link>
    </Pagina>
  );
}
