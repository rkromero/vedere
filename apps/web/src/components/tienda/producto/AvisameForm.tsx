'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@vedere/ui';
import { tiendaApi, mensajeError } from '@/lib/tienda/client';

export function AvisameForm({ varianteId }: { varianteId: string }) {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    setError(null);
    try {
      await tiendaApi.post('/catalogo/avisos-stock', { email, varianteId });
      setEstado('ok');
    } catch (err) {
      setEstado('idle');
      setError(mensajeError(err));
    }
  }

  if (estado === 'ok') {
    return (
      <p role="status" className="font-text rounded-2xl bg-vetro/40 p-4 text-sm">
        Listo. Te avisamos por mail apenas vuelva este color.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="font-text rounded-2xl border border-negro/15 p-4">
      <label htmlFor="avisame-email" className="block font-medium">
        Avisame cuando vuelva
      </label>
      <p className="mb-3 text-sm text-gris-texto">Te mandamos un mail cuando haya stock de este color.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="avisame-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'avisame-error' : undefined}
          className="h-12 min-w-0 flex-1 rounded-full border border-negro/15 px-4 text-base placeholder:text-gris-texto focus:border-negro focus:outline-none"
        />
        <Button type="submit" variant="secondary" loading={estado === 'enviando'}>
          Avisarme
        </Button>
      </div>
      {error && (
        <p id="avisame-error" role="alert" className="mt-2 text-sm text-carey">
          {error}
        </p>
      )}
    </form>
  );
}
