'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Button, Field, Input } from '@vedere/ui';
import { erroresPorCampo, mensajeError } from '@/lib/tienda/client';
import { cuentaApi } from '@/lib/tienda/cuenta';

export function RestablecerForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok'>('idle');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setErrores({});
    if (password !== confirmar) {
      setErrores({ confirmar: 'Las contraseñas no coinciden' });
      return;
    }
    setEstado('enviando');
    try {
      await cuentaApi.restablecer(token, password);
      setEstado('ok');
    } catch (err) {
      setErrores(erroresPorCampo(err));
      setError(mensajeError(err));
      setEstado('idle');
    }
  }

  if (estado === 'ok') {
    return (
      <div role="status" className="font-text rounded-2xl bg-vetro/40 p-5">
        <p className="font-semibold">Listo, tu contraseña cambió</p>
        <p className="mt-1 text-sm">Ya podés ingresar con la contraseña nueva.</p>
        <Link href="/ingresar" className="mt-4 inline-block text-sm underline underline-offset-4">
          Ingresar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="font-text space-y-4" noValidate>
      <Field label="Contraseña nueva" required error={errores.password}>
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="restablecer-password"
          />
        )}
      </Field>
      <Field label="Repetir contraseña" required error={errores.confirmar}>
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
          {error}{' '}
          <Link href="/recuperar" className="underline underline-offset-4">
            Pedir un link nuevo
          </Link>
        </p>
      )}
      <Button type="submit" className="w-full" loading={estado === 'enviando'} data-testid="restablecer-submit">
        Guardar contraseña
      </Button>
    </form>
  );
}
