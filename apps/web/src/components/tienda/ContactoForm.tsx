'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Field, Input, Select, Textarea } from '@vedere/ui';
import { tiendaApi, TiendaApiError, mensajeError } from '@/lib/tienda/client';
import { MOTIVOS } from '@/lib/tienda/contacto';
import type { Motivo } from '@/lib/tienda/contacto';


export function ContactoForm({
  motivoInicial = 'CONSULTA',
  conPedido,
}: {
  motivoInicial?: Motivo;
  conPedido?: boolean;
}) {
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    motivo: motivoInicial as Motivo,
    pedido: '',
    mensaje: '',
    web: '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok'>('idle');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    setErrores({});
    setGeneral(null);
    try {
      await tiendaApi.post('/catalogo/contacto', {
        ...form,
        telefono: form.telefono || null,
        pedido: form.pedido || null,
      });
      setEstado('ok');
    } catch (err) {
      setEstado('idle');
      if (err instanceof TiendaApiError && Array.isArray(err.details)) {
        const porCampo: Record<string, string> = {};
        for (const d of err.details as Array<{ path?: string; message: string }>) {
          if (d.path && !porCampo[d.path]) porCampo[d.path] = d.message;
        }
        setErrores(porCampo);
      }
      setGeneral(mensajeError(err));
    }
  }

  if (estado === 'ok') {
    return (
      <div role="status" className="font-text rounded-3xl bg-vetro/40 p-6">
        <p className="font-campaign text-3xl">¡Gracias!</p>
        <p className="mt-2">
          Recibimos tu mensaje. Te respondemos por mail dentro de las 24 horas hábiles.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {general && (
        <p role="alert" className="font-text rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
          {general}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" required error={errores.nombre}>
          {(p) => <Input {...p} value={form.nombre} onChange={set('nombre')} autoComplete="name" />}
        </Field>
        <Field label="Email" required error={errores.email}>
          {(p) => (
            <Input {...p} type="email" inputMode="email" value={form.email} onChange={set('email')} autoComplete="email" />
          )}
        </Field>
        <Field label="Teléfono" hint="Opcional. Para coordinar el turno por WhatsApp." error={errores.telefono}>
          {(p) => (
            <Input {...p} type="tel" inputMode="tel" value={form.telefono} onChange={set('telefono')} autoComplete="tel" />
          )}
        </Field>
        <Field label="Motivo" required error={errores.motivo}>
          {(p) => (
            <Select {...p} value={form.motivo} onChange={set('motivo')}>
              {MOTIVOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {(conPedido || form.motivo === 'CAMBIO' || form.motivo === 'ARREPENTIMIENTO') && (
          <Field label="Número de pedido" hint="Lo encontrás en el mail de confirmación." error={errores.pedido}>
            {(p) => <Input {...p} value={form.pedido} onChange={set('pedido')} />}
          </Field>
        )}
      </div>
      <Field label="Mensaje" required error={errores.mensaje}>
        {(p) => (
          <Textarea
            {...p}
            value={form.mensaje}
            onChange={set('mensaje')}
            placeholder={
              form.motivo === 'TURNO'
                ? 'Contanos en qué zona estás y qué días te quedan cómodos.'
                : '¿En qué te ayudamos?'
            }
          />
        )}
      </Field>
      {/* Honeypot: oculto para personas; los bots lo completan. */}
      <div className="hidden" aria-hidden="true">
        <label>
          Sitio web
          <input tabIndex={-1} autoComplete="off" value={form.web} onChange={set('web')} />
        </label>
      </div>
      <Button type="submit" size="lg" loading={estado === 'enviando'}>
        Enviar
      </Button>
    </form>
  );
}
