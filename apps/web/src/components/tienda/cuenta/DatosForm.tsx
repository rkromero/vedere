'use client';
// Mis datos: nombre, teléfono y newsletter (PUT /cuenta/datos) + cambio de contraseña (PUT /cuenta/password).
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Checkbox, Field, Input } from '@vedere/ui';
import { erroresPorCampo, mensajeError } from '@/lib/tienda/client';
import { cuentaApi } from '@/lib/tienda/cuenta';
import type { UsuarioCuenta } from '@/lib/tienda/cuenta';

export function DatosForm({ user }: { user: UsuarioCuenta }) {
  const router = useRouter();
  const [form, setForm] = useState({ nombre: user.nombre, telefono: user.telefono ?? '', newsletter: user.newsletter });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [estado, setEstado] = useState<'idle' | 'guardando' | 'ok'>('idle');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrores({});
    setGeneral(null);
    setEstado('guardando');
    try {
      await cuentaApi.datos({
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim() || null,
        newsletter: form.newsletter,
      });
      setEstado('ok');
      router.refresh();
    } catch (err) {
      setErrores(erroresPorCampo(err));
      setGeneral(mensajeError(err));
      setEstado('idle');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Email" hint={user.googleVinculado ? 'Cuenta vinculada con Google.' : 'El email no se puede cambiar.'}>
        {(p) => <Input {...p} value={user.email} disabled readOnly />}
      </Field>
      <Field label="Nombre y apellido" required error={errores.nombre}>
        {(p) => (
          <Input {...p} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} autoComplete="name" data-testid="datos-nombre" />
        )}
      </Field>
      <Field label="Teléfono" error={errores.telefono} hint="Para avisarte cuando tu pedido esté listo.">
        {(p) => (
          <Input {...p} type="tel" value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} autoComplete="tel" />
        )}
      </Field>
      <Checkbox
        checked={form.newsletter}
        onChange={(e) => setForm((f) => ({ ...f, newsletter: e.target.checked }))}
        label="Quiero recibir novedades y lanzamientos por email"
      />
      {general && (
        <p role="alert" className="rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
          {general}
        </p>
      )}
      {estado === 'ok' && (
        <p role="status" className="rounded-2xl bg-vetro/40 px-4 py-3 text-sm">
          Datos guardados.
        </p>
      )}
      <Button type="submit" size="sm" loading={estado === 'guardando'} data-testid="datos-guardar">
        Guardar cambios
      </Button>
    </form>
  );
}

export function PasswordForm({ googleVinculado }: { googleVinculado: boolean }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [estado, setEstado] = useState<'idle' | 'guardando' | 'ok'>('idle');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrores({});
    setGeneral(null);
    if (nueva !== confirmar) {
      setErrores({ confirmar: 'Las contraseñas no coinciden' });
      return;
    }
    setEstado('guardando');
    try {
      await cuentaApi.password({ ...(actual ? { actual } : {}), nueva });
      setEstado('ok');
      setActual('');
      setNueva('');
      setConfirmar('');
    } catch (err) {
      setErrores(erroresPorCampo(err));
      setGeneral(mensajeError(err));
      setEstado('idle');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field
        label="Contraseña actual"
        error={errores.actual}
        hint={googleVinculado ? 'Si entrás con Google y nunca creaste una contraseña, dejalo vacío.' : undefined}
      >
        {(p) => <Input {...p} type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />}
      </Field>
      <Field label="Contraseña nueva" required hint="Mínimo 8 caracteres." error={errores.nueva ?? errores.password}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />}
      </Field>
      <Field label="Repetir contraseña nueva" required error={errores.confirmar}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />}
      </Field>
      {general && (
        <p role="alert" className="rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
          {general}
        </p>
      )}
      {estado === 'ok' && (
        <p role="status" className="rounded-2xl bg-vetro/40 px-4 py-3 text-sm">
          Contraseña actualizada.
        </p>
      )}
      <Button type="submit" variant="secondary" size="sm" loading={estado === 'guardando'}>
        Cambiar contraseña
      </Button>
    </form>
  );
}
