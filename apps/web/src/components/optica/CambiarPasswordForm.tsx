'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, api, errorMessage } from '@/lib/api-client';
import { Btn, Field, Input } from '@/components/admin/ui';

export function CambiarPasswordForm({ obligatorio }: { obligatorio: boolean }) {
  const router = useRouter();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setGeneral(null);
    const errs: Record<string, string> = {};
    if (!actual) errs.actual = obligatorio ? 'Ingresá la contraseña provisoria que te llegó por email' : 'Ingresá tu contraseña actual';
    if (nueva.length < 8) errs.nueva = 'Tiene que tener al menos 8 caracteres';
    if (nueva && repetir !== nueva) errs.repetir = 'Las contraseñas no coinciden';
    setErrores(errs);
    if (Object.keys(errs).length) return;
    setEnviando(true);
    try {
      await api.post('/optica/password', { actual, nueva });
      router.replace('/optica');
      router.refresh();
    } catch (err) {
      setEnviando(false);
      if (err instanceof ApiError) {
        const campo = (err.details as { campo?: string } | undefined)?.campo;
        if (campo) {
          setErrores({ [campo]: err.message });
          return;
        }
        setErrores(err.fieldErrors);
      }
      setGeneral(errorMessage(err));
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate data-testid="cambiar-password">
      {general && (
        <p role="alert" className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">
          {general}
        </p>
      )}
      <Field label={obligatorio ? 'Contraseña provisoria' : 'Contraseña actual'} error={errores.actual}>
        <Input
          type="password"
          name="actual"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          autoFocus
        />
      </Field>
      <Field label="Contraseña nueva" error={errores.nueva} hint="Mínimo 8 caracteres.">
        <Input type="password" name="nueva" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
      </Field>
      <Field label="Repetí la contraseña nueva" error={errores.repetir}>
        <Input type="password" name="repetir" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
      </Field>
      <Btn type="submit" className="w-full" loading={enviando}>
        Guardar y entrar
      </Btn>
    </form>
  );
}
