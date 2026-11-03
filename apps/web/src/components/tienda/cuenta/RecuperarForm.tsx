'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Button, Field, Input } from '@vedere/ui';
import { mensajeError } from '@/lib/tienda/client';
import { cuentaApi } from '@/lib/tienda/cuenta';

export function RecuperarForm() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEstado('enviando');
    try {
      await cuentaApi.recuperar(email.trim());
      setEstado('ok');
    } catch (err) {
      setError(mensajeError(err));
      setEstado('idle');
    }
  }

  if (estado === 'ok') {
    return (
      <div role="status" className="font-text rounded-2xl bg-vetro/40 p-5">
        <p className="font-semibold">Revisá tu casilla</p>
        <p className="mt-1 text-sm">
          Si existe una cuenta con <strong>{email.trim()}</strong>, te llegó un email con el link para crear una
          contraseña nueva. Mirá también la carpeta de spam.
        </p>
        <Link href="/ingresar" className="mt-4 inline-block text-sm underline underline-offset-4">
          Volver a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="font-text space-y-4" noValidate>
      <Field label="Email de tu cuenta" required>
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="recuperar-email"
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" loading={estado === 'enviando'} data-testid="recuperar-submit">
        Enviarme el link
      </Button>
      <p className="text-center text-sm text-gris-texto">
        <Link href="/ingresar" className="underline underline-offset-4 hover:text-negro">
          Volver a ingresar
        </Link>
      </p>
    </form>
  );
}
