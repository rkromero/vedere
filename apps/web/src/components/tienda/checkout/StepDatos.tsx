'use client';
// Paso 1: datos y contacto. Compra como invitado, con cuenta (login inline) o creando una cuenta.
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Button, Checkbox, Field, Input } from '@vedere/ui';
import { mensajeError, tiendaApi } from '@/lib/tienda/client';

export interface DatosContacto {
  email: string;
  nombre: string;
  dni: string;
  telefono: string;
}

export interface CuentaNueva {
  crear: boolean;
  password: string;
}

export interface UsuarioSesion {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
}

export function StepDatos({
  valor,
  errores,
  usuario,
  onUsuario,
  cuenta,
  onCuenta,
  onContinuar,
}: {
  valor: DatosContacto;
  errores: Record<string, string>;
  usuario: UsuarioSesion | null;
  onUsuario: (u: UsuarioSesion | null) => void;
  cuenta: CuentaNueva;
  onCuenta: (c: CuentaNueva) => void;
  onContinuar: (datos: DatosContacto) => void;
}) {
  const [form, setForm] = useState<DatosContacto>(valor);
  const [modo, setModo] = useState<'invitado' | 'login'>('invitado');
  const [login, setLogin] = useState({ email: valor.email, password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [localErr, setLocalErr] = useState<Record<string, string>>({});

  const set = (k: keyof DatosContacto) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  function validar(): boolean {
    const err: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) err.email = 'Ingresá un email válido';
    if (form.nombre.trim().length < 2) err.nombre = 'Ingresá tu nombre y apellido';
    if (!/^\d{7,8}$/.test(form.dni.replace(/\D/g, ''))) err.dni = 'DNI de 7 u 8 números';
    if (form.telefono.replace(/\D/g, '').length < 8) err.telefono = 'Ingresá un teléfono válido';
    if (cuenta.crear && !usuario && cuenta.password.length < 8) err.password = 'Mínimo 8 caracteres';
    setLocalErr(err);
    return Object.keys(err).length === 0;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validar()) return;
    onContinuar({ ...form, email: form.email.trim().toLowerCase(), dni: form.dni.replace(/\D/g, '') });
  }

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setLoginError(null);
    try {
      const res = await tiendaApi.post<{ user: UsuarioSesion }>('/auth/login', login);
      onUsuario(res.user);
      setForm({ ...form, email: res.user.email, nombre: res.user.nombre, telefono: res.user.telefono ?? form.telefono });
      setModo('invitado');
    } catch (err) {
      setLoginError(mensajeError(err));
    } finally {
      setEntrando(false);
    }
  }

  const err = { ...localErr, ...errores };

  return (
    <div className="space-y-5">
      {usuario ? (
        <p className="rounded-xl bg-gris-claro px-4 py-3 text-sm">
          Comprás con tu cuenta <strong>{usuario.email}</strong>. El pedido y tu receta quedan guardados en{' '}
          <Link href="/cuenta" className="underline underline-offset-4">
            Mi cuenta
          </Link>
          .
        </p>
      ) : modo === 'login' ? (
        <form onSubmit={entrar} className="space-y-4 rounded-xl border border-negro/10 p-4">
          <p className="text-sm font-medium">Ingresá a tu cuenta</p>
          <Field label="Email" required>
            {(p) => (
              <Input {...p} type="email" autoComplete="email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
            )}
          </Field>
          <Field label="Contraseña" required error={loginError ?? undefined}>
            {(p) => (
              <Input {...p} type="password" autoComplete="current-password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
            )}
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="sm" loading={entrando}>
              Ingresar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setModo('invitado')}>
              Seguir como invitado
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gris-texto">
          Podés comprar sin cuenta.{' '}
          <button type="button" onClick={() => setModo('login')} className="underline underline-offset-4">
            ¿Ya tenés cuenta? Ingresá
          </button>
        </p>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" required error={err.email} hint="Te mandamos la confirmación acá." className="sm:col-span-2">
            {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} readOnly={!!usuario} />}
          </Field>
          <Field label="Nombre y apellido" required error={err.nombre} className="sm:col-span-2">
            {(p) => <Input {...p} autoComplete="name" value={form.nombre} onChange={set('nombre')} />}
          </Field>
          <Field label="DNI" required error={err.dni} hint="Sin puntos. Lo necesita la óptica para la receta.">
            {(p) => <Input {...p} inputMode="numeric" autoComplete="off" value={form.dni} onChange={set('dni')} maxLength={10} />}
          </Field>
          <Field label="Teléfono" required error={err.telefono} hint="Con código de área, ej. 11 5555 1234.">
            {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" value={form.telefono} onChange={set('telefono')} />}
          </Field>
        </div>

        {!usuario && (
          <div className="rounded-xl bg-gris-claro p-4">
            <Checkbox
              label="Crear una cuenta para seguir mis pedidos y guardar mi receta"
              checked={cuenta.crear}
              onChange={(e) => onCuenta({ ...cuenta, crear: e.target.checked })}
            />
            {cuenta.crear && (
              <Field label="Contraseña" required error={err.password} hint="Mínimo 8 caracteres." className="mt-3">
                {(p) => (
                  <Input {...p} type="password" autoComplete="new-password" value={cuenta.password} onChange={(e) => onCuenta({ ...cuenta, password: e.target.value })} />
                )}
              </Field>
            )}
          </div>
        )}

        <Button type="submit" size="md" className="w-full sm:w-auto">
          Continuar a entrega
        </Button>
      </form>
    </div>
  );
}
