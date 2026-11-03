import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@vedere/ui';
import { getSession } from '@/lib/session';
import { nextSeguro } from '@/lib/tienda/cuenta';
import { AuthForms } from '@/components/tienda/cuenta/AuthForms';

export const metadata: Metadata = { title: 'Ingresar', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; tab?: string; error?: string }>;
}) {
  const { next, tab, error } = await searchParams;
  const destino = nextSeguro(next);
  const user = await getSession();
  if (user) redirect(destino);

  return (
    <section className="bg-gris-claro">
      <Container className="py-10 md:py-16">
        <div className="mx-auto max-w-md rounded-3xl bg-blanco p-6 shadow-sm md:p-8">
          <h1 className="font-campaign text-4xl md:text-5xl">Mi cuenta</h1>
          <p className="font-text mt-2 text-sm text-gris-texto">
            Seguí tus pedidos, guardá tu receta y tus direcciones, y compartí tu link de referidos.
          </p>
          <div className="mt-6">
            <AuthForms next={destino} tabInicial={tab === 'crear' ? 'crear' : 'ingresar'} errorInicial={error ?? null} />
          </div>
        </div>
      </Container>
    </section>
  );
}
