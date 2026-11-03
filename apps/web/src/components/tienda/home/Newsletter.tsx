'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Button, Container } from '@vedere/ui';
import { tiendaApi, erroresPorCampo, mensajeError } from '@/lib/tienda/client';

const inputClass =
  'h-12 min-w-0 flex-1 rounded-full border border-negro/15 bg-blanco px-5 text-base placeholder:text-gris-texto focus:border-negro focus:outline-none';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    setError(null);
    try {
      await tiendaApi.post('/catalogo/newsletter', { email, nombre: nombre.trim() || null, origen: 'home' });
      setEstado('ok');
      setEmail('');
      setNombre('');
    } catch (err) {
      setEstado('error');
      const porCampo = erroresPorCampo(err);
      setError(porCampo.email ?? porCampo.nombre ?? mensajeError(err));
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
            Lanzamientos, cápsulas y descuentos para suscriptores. Un mail al mes, como mucho. Te podés dar de
            baja con un click desde cualquier email.
          </p>
        </div>
        {estado === 'ok' ? (
          <p className="font-text rounded-2xl bg-vetro/40 px-5 py-4 text-base" role="status" data-testid="newsletter-ok">
            ¡Listo! Te sumamos a la lista. Te mandamos un email de bienvenida con el link para darte de baja cuando
            quieras.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="font-text flex flex-col gap-2" data-testid="newsletter-form">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="newsletter-nombre" className="sr-only">
                Tu nombre
              </label>
              <input
                id="newsletter-nombre"
                type="text"
                autoComplete="given-name"
                maxLength={120}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre (opcional)"
                className={inputClass}
              />
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
                aria-describedby={error ? 'newsletter-error' : 'newsletter-legal'}
                className={inputClass}
                data-testid="newsletter-email"
              />
              <Button type="submit" loading={estado === 'enviando'} data-testid="newsletter-submit">
                Suscribirme
              </Button>
            </div>
            {error ? (
              <p id="newsletter-error" role="alert" className="text-sm text-carey">
                {error}
              </p>
            ) : (
              <p id="newsletter-legal" className="text-xs text-gris-texto">
                Al suscribirte aceptás nuestra{' '}
                <Link href="/legal/privacidad" className="underline underline-offset-2">
                  política de privacidad
                </Link>
                .
              </p>
            )}
          </form>
        )}
      </Container>
    </section>
  );
}
