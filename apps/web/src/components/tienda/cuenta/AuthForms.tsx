'use client';
// Ingresar / Crear cuenta (prompt 6). Login y registro por email + contraseña contra /auth/*, botón de
// Google si la API lo tiene habilitado (/sitio/config → googleLogin) y código de referido desde la cookie.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Checkbox, Field, Input, cn } from '@vedere/ui';
import { track } from '@/lib/analytics';
import { erroresPorCampo, mensajeError, tiendaApi } from '@/lib/tienda/client';
import { REF_COOKIE, cuentaApi, leerCookie, nextSeguro } from '@/lib/tienda/cuenta';
import type { SitioConfigCuenta } from '@/lib/tienda/cuenta';

type Tab = 'ingresar' | 'crear';

const MENSAJES_ERROR: Record<string, string> = {
  google: 'No pudimos completar el ingreso con Google. Probá de nuevo o usá tu email y contraseña.',
  sesion: 'Tu sesión venció. Volvé a ingresar.',
};

export function AuthForms({
  next,
  tabInicial = 'ingresar',
  errorInicial,
}: {
  next: string;
  tabInicial?: Tab;
  errorInicial?: string | null;
}) {
  const [tab, setTab] = useState<Tab>(tabInicial);
  const [google, setGoogle] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const destino = nextSeguro(next);

  useEffect(() => {
    let cancelado = false;
    tiendaApi
      .get<SitioConfigCuenta>('/sitio/config')
      .then((c) => {
        if (!cancelado) setGoogle(!!c?.googleLogin);
      })
      .catch(() => undefined);
    setRef(leerCookie(REF_COOKIE));
    return () => {
      cancelado = true;
    };
  }, []);

  const googleHref = `/api/auth/google?next=${encodeURIComponent(destino)}`;
  const aviso = errorInicial ? (MENSAJES_ERROR[errorInicial] ?? null) : null;

  return (
    <div className="font-text">
      <div role="tablist" aria-label="Ingresar o crear cuenta" className="grid grid-cols-2 rounded-2xl bg-gris-claro p-1">
        {(
          [
            ['ingresar', 'Ingresar'],
            ['crear', 'Crear cuenta'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'h-11 rounded-xl text-sm font-medium transition-colors',
              tab === id ? 'bg-blanco text-negro shadow-sm' : 'text-gris-texto hover:text-negro',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {aviso && (
        <p role="alert" className="mt-4 rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
          {aviso}
        </p>
      )}

      {ref && tab === 'crear' && (
        <p className="mt-4 rounded-2xl bg-vetro/30 px-4 py-3 text-sm">
          Venís recomendado por un cliente Vedere: cuando hagas tu primera compra, los dos reciben un cupón de descuento.
        </p>
      )}

      {google && (
        <div className="mt-6">
          <a
            href={googleHref}
            className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-negro/20 bg-blanco px-6 text-base font-medium text-negro transition-colors hover:bg-gris-claro"
            data-testid="login-google"
          >
            <GoogleIcon />
            Continuar con Google
          </a>
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-gris-texto">
            <span className="h-px flex-1 bg-negro/10" />o con tu email<span className="h-px flex-1 bg-negro/10" />
          </div>
        </div>
      )}

      <div className={cn(!google && 'mt-6')}>
        {tab === 'ingresar' ? <LoginForm next={destino} /> : <RegistroForm next={destino} codigoRef={ref} />}
      </div>
    </div>
  );
}

function LoginForm({ next }: { next: string }) {
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
      await cuentaApi.login({ email: email.trim(), password });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(mensajeError(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Email" required>
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="login-email"
          />
        )}
      </Field>
      <Field label="Contraseña" required>
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="login-password"
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" loading={loading} data-testid="login-submit">
        Ingresar
      </Button>
      <p className="text-center text-sm text-gris-texto">
        <Link href="/recuperar" className="underline underline-offset-4 hover:text-negro">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
    </form>
  );
}

function RegistroForm({ next, codigoRef }: { next: string; codigoRef: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', password: '' });
  const [acepta, setAcepta] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrores({});
    setGeneral(null);
    if (!acepta) {
      setGeneral('Tenés que aceptar los términos y condiciones para crear tu cuenta.');
      return;
    }
    setLoading(true);
    try {
      await cuentaApi.registro({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
        ...(form.telefono.trim() ? { telefono: form.telefono.trim() } : {}),
        ...(codigoRef ? { ref: codigoRef } : {}),
      });
      track('sign_up');
      router.push(next);
      router.refresh();
    } catch (err) {
      setErrores(erroresPorCampo(err));
      setGeneral(mensajeError(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Nombre y apellido" required error={errores.nombre}>
        {(p) => (
          <Input {...p} value={form.nombre} onChange={set('nombre')} autoComplete="name" data-testid="registro-nombre" />
        )}
      </Field>
      <Field label="Email" required error={errores.email}>
        {(p) => (
          <Input
            {...p}
            type="email"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
            data-testid="registro-email"
          />
        )}
      </Field>
      <Field label="Teléfono" hint="Opcional. Para avisarte cuando tu pedido esté listo." error={errores.telefono}>
        {(p) => (
          <Input
            {...p}
            type="tel"
            value={form.telefono}
            onChange={set('telefono')}
            autoComplete="tel"
            placeholder="+54 9 11 1234 5678"
          />
        )}
      </Field>
      <Field label="Contraseña" required hint="Mínimo 8 caracteres." error={errores.password}>
        {(p) => (
          <Input
            {...p}
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            data-testid="registro-password"
          />
        )}
      </Field>
      <Checkbox
        checked={acepta}
        onChange={(e) => setAcepta(e.target.checked)}
        label={
          <>
            Acepto los{' '}
            <Link href="/legal/terminos" className="underline underline-offset-4" target="_blank">
              términos y condiciones
            </Link>{' '}
            y la{' '}
            <Link href="/legal/privacidad" className="underline underline-offset-4" target="_blank">
              política de privacidad
            </Link>
            .
          </>
        }
      />
      {general && (
        <p role="alert" className="rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
          {general}
        </p>
      )}
      <Button type="submit" className="w-full" loading={loading} data-testid="registro-submit">
        Crear cuenta
      </Button>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7-10.2 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.1.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
