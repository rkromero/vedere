import type { Metadata } from 'next';
import { Container } from '@vedere/ui';
import { RestablecerForm } from '@/components/tienda/cuenta/RestablecerForm';

export const metadata: Metadata = { title: 'Nueva contraseña', robots: { index: false } };

export default async function RestablecerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <section className="bg-gris-claro">
      <Container className="py-10 md:py-16">
        <div className="mx-auto max-w-md rounded-3xl bg-blanco p-6 shadow-sm md:p-8">
          <h1 className="font-campaign text-4xl md:text-5xl">Nueva contraseña</h1>
          <p className="font-text mt-2 text-sm text-gris-texto">Elegí una contraseña de al menos 8 caracteres.</p>
          <div className="mt-6">
            <RestablecerForm token={token} />
          </div>
        </div>
      </Container>
    </section>
  );
}
