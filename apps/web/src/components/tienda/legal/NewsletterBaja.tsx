'use client';
// Baja del newsletter en un click (link del pie de los emails), sin login.
import { useState } from 'react';
import Link from 'next/link';
import { Button, buttonClasses } from '@vedere/ui';
import { tiendaApi, mensajeError } from '@/lib/tienda/client';

export function NewsletterBaja({ token, email, activa }: { token: string; email: string; activa: boolean }) {
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok'>(activa ? 'idle' : 'ok');
  const [error, setError] = useState<string | null>(null);

  async function darBaja() {
    setEstado('enviando');
    setError(null);
    try {
      await tiendaApi.post(`/sitio/newsletter/baja/${encodeURIComponent(token)}`);
      setEstado('ok');
    } catch (err) {
      setEstado('idle');
      setError(mensajeError(err));
    }
  }

  if (estado === 'ok') {
    return (
      <div role="status" className="font-text rounded-3xl bg-vetro/40 p-6">
        <p className="text-lg font-semibold">Listo, {email} ya no recibe el newsletter.</p>
        <p className="mt-2 text-negro/75">
          Igual vas a seguir recibiendo los emails de tus pedidos. Si cambiás de idea, suscribite de nuevo desde la
          home.
        </p>
        <Link href="/" className={buttonClasses('primary', 'md', 'mt-5')}>
          Volver a la tienda
        </Link>
      </div>
    );
  }

  return (
    <div className="font-text rounded-3xl border border-negro/10 p-6">
      <p>
        Vas a dar de baja a <strong data-testid="newsletter-baja-email">{email}</strong> del newsletter de Vedere.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-carey">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={darBaja} loading={estado === 'enviando'} data-testid="newsletter-baja-confirmar">
          Darme de baja
        </Button>
        <Link href="/" className={buttonClasses('secondary')}>
          Cancelar
        </Link>
      </div>
    </div>
  );
}
