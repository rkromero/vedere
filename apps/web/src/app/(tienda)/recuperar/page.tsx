import type { Metadata } from 'next';
import { Container } from '@vedere/ui';
import { RecuperarForm } from '@/components/tienda/cuenta/RecuperarForm';

export const metadata: Metadata = { title: 'Recuperar contraseña', robots: { index: false } };

export default function RecuperarPage() {
  return (
    <section className="bg-gris-claro">
      <Container className="py-10 md:py-16">
        <div className="mx-auto max-w-md rounded-3xl bg-blanco p-6 shadow-sm md:p-8">
          <h1 className="font-campaign text-4xl md:text-5xl">Recuperar contraseña</h1>
          <p className="font-text mt-2 text-sm text-gris-texto">
            Te mandamos un link por email para elegir una contraseña nueva. Vale por una hora.
          </p>
          <div className="mt-6">
            <RecuperarForm />
          </div>
        </div>
      </Container>
    </section>
  );
}
