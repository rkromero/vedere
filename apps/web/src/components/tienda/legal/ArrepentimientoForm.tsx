'use client';
// Formulario del botón de arrepentimiento (Res. 424/2020): POST /sitio/arrepentimiento devuelve el
// número de trámite, que se muestra en grande y se puede copiar.
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Button, Field, Input, Textarea, buttonClasses } from '@vedere/ui';
import { tiendaApi, erroresPorCampo, mensajeError } from '@/lib/tienda/client';
import type { ArrepentimientoRespuesta } from '@/lib/tienda/sitio';

export function ArrepentimientoForm({ pedidoInicial = '' }: { pedidoInicial?: string }) {
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    dni: '',
    telefono: '',
    pedidoNumero: pedidoInicial,
    motivo: '',
    web: '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [estado, setEstado] = useState<'idle' | 'enviando'>('idle');
  const [resultado, setResultado] = useState<ArrepentimientoRespuesta | null>(null);
  const [copiado, setCopiado] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.web) return; // honeypot
    setEstado('enviando');
    setErrores({});
    setGeneral(null);
    try {
      const r = await tiendaApi.post<ArrepentimientoRespuesta>('/sitio/arrepentimiento', {
        nombre: form.nombre,
        email: form.email,
        dni: form.dni || null,
        telefono: form.telefono || null,
        pedidoNumero: form.pedidoNumero || null,
        motivo: form.motivo || null,
      });
      setResultado(r);
    } catch (err) {
      setErrores(erroresPorCampo(err));
      setGeneral(mensajeError(err));
    } finally {
      setEstado('idle');
    }
  }

  async function copiar() {
    if (!resultado) return;
    try {
      await navigator.clipboard.writeText(resultado.numeroTramite);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin permisos de portapapeles */
    }
  }

  if (resultado) {
    const fecha = new Date(resultado.createdAt).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });
    return (
      <div role="status" className="font-text rounded-3xl bg-vetro/40 p-6 md:p-8">
        <p className="text-sm uppercase tracking-wider text-negro/70">Solicitud recibida · número de trámite</p>
        <p className="font-campaign mt-2 text-4xl md:text-5xl" data-testid="arrepentimiento-numero">
          {resultado.numeroTramite}
        </p>
        <p className="mt-3 text-sm text-negro/75">Registrada el {fecha}.</p>
        <p className="mt-4">
          Te mandamos un email a <strong>{form.email}</strong> con este número. Dentro de las 24 horas
          hábiles te contactamos con las instrucciones para la devolución; el reintegro se acredita en el
          mismo medio de pago. Guardá el número para cualquier consulta.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={copiar}>
            {copiado ? 'Copiado' : 'Copiar número'}
          </Button>
          <Link href="/" className={buttonClasses('primary')}>
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="font-text grid gap-4 sm:grid-cols-2" aria-describedby={general ? 'arrepentimiento-error' : undefined}>
      <Field label="Nombre y apellido" required error={errores.nombre}>
        {(p) => (
          <Input {...p} value={form.nombre} onChange={set('nombre')} autoComplete="name" data-testid="arrepentimiento-nombre" />
        )}
      </Field>
      <Field label="Email de la compra" required error={errores.email}>
        {(p) => (
          <Input
            {...p}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            data-testid="arrepentimiento-email"
          />
        )}
      </Field>
      <Field label="DNI" hint="Opcional, agiliza la verificación." error={errores.dni}>
        {(p) => <Input {...p} inputMode="numeric" value={form.dni} onChange={set('dni')} data-testid="arrepentimiento-dni" />}
      </Field>
      <Field label="Teléfono" hint="Opcional." error={errores.telefono}>
        {(p) => <Input {...p} type="tel" autoComplete="tel" value={form.telefono} onChange={set('telefono')} />}
      </Field>
      <Field label="Número de pedido" hint="Ej. VD-10001 (está en el email de confirmación)." error={errores.pedidoNumero}>
        {(p) => <Input {...p} value={form.pedidoNumero} onChange={set('pedidoNumero')} data-testid="arrepentimiento-pedido" />}
      </Field>
      <Field label="Motivo" hint="Opcional: no hace falta justificar el arrepentimiento." className="sm:col-span-2" error={errores.motivo}>
        {(p) => <Textarea {...p} value={form.motivo} onChange={set('motivo')} data-testid="arrepentimiento-motivo" />}
      </Field>
      {/* Honeypot anti-spam */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="arr-web">Sitio web</label>
        <input id="arr-web" tabIndex={-1} autoComplete="off" value={form.web} onChange={set('web')} />
      </div>
      {general && (
        <p id="arrepentimiento-error" role="alert" className="text-sm text-carey sm:col-span-2">
          {general}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" loading={estado === 'enviando'} data-testid="arrepentimiento-enviar">
          Solicitar la revocación de la compra
        </Button>
        <p className="mt-3 text-xs text-gris-texto">
          Al enviar, generamos un número de trámite y te lo mandamos por email, como exige la Resolución
          424/2020 de la Secretaría de Comercio Interior.
        </p>
      </div>
    </form>
  );
}
