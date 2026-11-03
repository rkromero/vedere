'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api-client';
import { Btn, Field, Input } from '@/components/admin/ui';

export function LoginForm({
  next,
  roles = ['ADMIN', 'OPERADOR'],
  mensajeDenegado = 'Tu usuario no tiene acceso al backoffice.',
}: {
  next: string;
  /** Roles que pueden entrar por este formulario (backoffice: ADMIN/OPERADOR; panel de ópticas: OPTICA). */
  roles?: string[];
  mensajeDenegado?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await api.post<{ user: { rol: string } }>('/auth/login', {
        email,
        password,
      });
      if (!roles.includes(user.rol)) {
        await api.post('/auth/logout').catch(() => undefined);
        setError(mensajeDenegado);
        return;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email" required>
        <Input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </Field>
      <Field label="Contraseña" required>
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      {error && <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{error}</p>}
      <Btn type="submit" className="w-full" loading={loading}>
        Ingresar
      </Btn>
    </form>
  );
}
