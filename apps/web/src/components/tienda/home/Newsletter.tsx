'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Container } from '@vedere/ui';
import { tiendaApi, mensajeError } from '@/lib/tienda/client';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    setError(null);
    try {
      await tiendaApi.post('/catalogo/newsletter', { email, origen: 'home' });
      setEstado('ok');
      setEmail('');
    } catch (err) {
      setEstado('error');
      setError(mensajeError(err));
    }
  }

  return (
    <section aria-labelledby="newsletter-titulo" className="bg-gris-claro">
      <Container className="grid gap-6 py-14 md:grid-cols-2 md:items-center md:py-20">
        <div className="font-text">
          <h2 id="newsletter-titulo" className="font-campaign text-4xl md:text-5xl">
            Novedades
            <br />
            sin spam
          </h2>
          <p className="mt-3 text-gris-texto">
            Lanzamientos, cápsulas y descuentos para suscriptores. Un mail al mes, como mucho.
          </p>
        </div>
        {estado === 'ok' ? (
          <p className="font-text rounded-2xl bg-vetro/40 px-5 py-4 text-base" role="status">
            ¡Listo! Te sumamos a la lista. Revisá tu casilla para confirmar.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="font-text flex flex-col gap-2 sm:flex-row">
            <label htmlFor="newsletter-email" className="sr-only">
              Tu email
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'newsletter-error' : undefined}
              className="h-12 min-w-0 flex-1 rounded-full border border-negro/15 bg-blanco px-5 text-base placeholder:text-gris-texto focus:border-negro focus:outline-none"
            />
            <Button type="submit" loading={estado === 'enviando'}>
              Suscribirme
            </Button>
            {error && (
              <p id="newsletter-error" role="alert" className="text-sm text-carey sm:basis-full">
                {error}
              </p>
            )}
          </form>
        )}
      </Container>
    </section>
  );
}
