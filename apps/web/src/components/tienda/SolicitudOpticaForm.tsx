'use client';
// Solicitud de alta al programa de ópticas socias: datos fiscales (CUIT con dígito verificador), ubicación,
// contacto, óptico responsable, habilitación (foto o PDF a R2) y aceptación de los términos del programa.
import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { Button, Checkbox, Field, Input, Select } from '@vedere/ui';
import { erroresPorCampo, mensajeError, tiendaApi } from '@/lib/tienda/client';
import { MENSAJE_CUIT, errorCuit } from '@/lib/cuit';

const CONDICIONES = [
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable inscripto' },
  { value: 'MONOTRIBUTO', label: 'Monotributo' },
  { value: 'EXENTO', label: 'Exento' },
];

const PROVINCIAS = [
  'Ciudad Autónoma de Buenos Aires',
  'Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
];

const MAX_MB = 10;

type Campo =
  | 'razonSocial'
  | 'nombreComercial'
  | 'cuit'
  | 'condicionIva'
  | 'direccion'
  | 'localidad'
  | 'provincia'
  | 'codigoPostal'
  | 'telefono'
  | 'whatsapp'
  | 'email'
  | 'opticoResponsable'
  | 'matricula'
  | 'web'
  | 'referidaPorCuit';

const VACIO: Record<Campo, string> = {
  razonSocial: '',
  nombreComercial: '',
  cuit: '',
  condicionIva: '',
  direccion: '',
  localidad: '',
  provincia: '',
  codigoPostal: '',
  telefono: '',
  whatsapp: '',
  email: '',
  opticoResponsable: '',
  matricula: '',
  web: '',
  referidaPorCuit: '',
};

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="font-text mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-negro/60">{titulo}</legend>
      {children}
    </fieldset>
  );
}

export function SolicitudOpticaForm() {
  const [form, setForm] = useState(VACIO);
  const [acepta, setAcepta] = useState(false);
  const [habilitacion, setHabilitacion] = useState<{ url: string; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok'>('idle');
  const [enviadoA, setEnviadoA] = useState('');

  const set = (k: Campo) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errores[k]) setErrores(({ [k]: _x, ...rest }) => rest);
  };

  function validarCuit() {
    if (!form.cuit.trim()) return;
    const e = errorCuit(form.cuit);
    setErrores((prev) => {
      const { cuit: _c, ...rest } = prev;
      return e ? { ...rest, cuit: MENSAJE_CUIT[e] } : rest;
    });
  }

  async function subir(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrores((p) => ({ ...p, habilitacionUrl: `El archivo supera los ${MAX_MB} MB` }));
      return;
    }
    setSubiendo(true);
    setErrores(({ habilitacionUrl: _h, ...rest }) => rest);
    try {
      const r = await tiendaApi.upload<{ url: string; nombre: string }>('/sitio/opticas/habilitacion', file);
      setHabilitacion({ url: r.url, nombre: r.nombre });
    } catch (err) {
      setErrores((p) => ({ ...p, habilitacionUrl: mensajeError(err) }));
    } finally {
      setSubiendo(false);
    }
  }

  function validarLocal(): Record<string, string> {
    const e: Record<string, string> = {};
    const requeridos: Array<[Campo, string]> = [
      ['razonSocial', 'Ingresá la razón social'],
      ['nombreComercial', 'Ingresá el nombre comercial'],
      ['condicionIva', 'Elegí la condición frente al IVA'],
      ['direccion', 'Ingresá la dirección'],
      ['localidad', 'Ingresá la localidad'],
      ['provincia', 'Elegí la provincia'],
      ['codigoPostal', 'Ingresá el código postal'],
      ['telefono', 'Ingresá un teléfono'],
      ['email', 'Ingresá un email'],
      ['opticoResponsable', 'Ingresá el nombre del óptico responsable'],
      ['matricula', 'Ingresá la matrícula'],
    ];
    for (const [k, msg] of requeridos) if (!form[k].trim()) e[k] = msg;
    if (!form.cuit.trim()) e.cuit = 'Ingresá el CUIT';
    else {
      const c = errorCuit(form.cuit);
      if (c) e.cuit = MENSAJE_CUIT[c];
    }
    if (!habilitacion) e.habilitacionUrl = 'Adjuntá la habilitación del local';
    if (!acepta) e.aceptaTerminos = 'Tenés que aceptar los términos del programa';
    return e;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setGeneral(null);
    const locales = validarLocal();
    if (Object.keys(locales).length) {
      setErrores(locales);
      setGeneral('Revisá los campos marcados.');
      return;
    }
    setEstado('enviando');
    try {
      const r = await tiendaApi.post<{ email: string }>('/sitio/opticas/solicitudes', {
        ...form,
        whatsapp: form.whatsapp || null,
        referidaPorCuit: form.referidaPorCuit.trim() || null,
        habilitacionUrl: habilitacion!.url,
        habilitacionNombre: habilitacion!.nombre,
        aceptaTerminos: true,
      });
      setEnviadoA(r?.email ?? form.email);
      setEstado('ok');
    } catch (err) {
      setEstado('idle');
      setErrores(erroresPorCampo(err));
      setGeneral(mensajeError(err));
    }
  }

  if (estado === 'ok') {
    return (
      <div role="status" className="font-text rounded-3xl bg-vetro/40 p-6" data-testid="solicitud-ok">
        <p className="font-campaign text-3xl">¡Recibimos tu solicitud!</p>
        <p className="mt-2">
          Te mandamos una confirmación a <strong>{enviadoA}</strong>. Revisamos los datos y la habilitación en los próximos
          días hábiles; cuando la aprobemos te llega el acceso al panel de ópticas socias.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate data-testid="solicitud-optica">
      {general && (
        <p role="alert" className="font-text rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
          {general}
        </p>
      )}

      <Seccion titulo="Datos fiscales">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Razón social" required error={errores.razonSocial}>
            {(p) => <Input {...p} name="razonSocial" value={form.razonSocial} onChange={set('razonSocial')} autoComplete="organization" />}
          </Field>
          <Field label="Nombre comercial" required error={errores.nombreComercial} hint="Como figura en el local.">
            {(p) => <Input {...p} name="nombreComercial" value={form.nombreComercial} onChange={set('nombreComercial')} />}
          </Field>
          <Field label="CUIT" required error={errores.cuit} hint="11 números, con o sin guiones.">
            {(p) => (
              <Input
                {...p}
                name="cuit"
                inputMode="numeric"
                placeholder="30-71234567-1"
                value={form.cuit}
                onChange={set('cuit')}
                onBlur={validarCuit}
              />
            )}
          </Field>
          <Field label="Condición frente al IVA" required error={errores.condicionIva}>
            {(p) => (
              <Select {...p} name="condicionIva" value={form.condicionIva} onChange={set('condicionIva')}>
                <option value="">Elegí…</option>
                {CONDICIONES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="Local y contacto">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dirección del local" required error={errores.direccion} className="sm:col-span-2">
            {(p) => <Input {...p} name="direccion" value={form.direccion} onChange={set('direccion')} autoComplete="street-address" placeholder="Av. Cabildo 2240" />}
          </Field>
          <Field label="Localidad" required error={errores.localidad}>
            {(p) => <Input {...p} name="localidad" value={form.localidad} onChange={set('localidad')} autoComplete="address-level2" />}
          </Field>
          <Field label="Provincia" required error={errores.provincia}>
            {(p) => (
              <Select {...p} name="provincia" value={form.provincia} onChange={set('provincia')}>
                <option value="">Elegí…</option>
                {PROVINCIAS.map((pr) => (
                  <option key={pr} value={pr}>
                    {pr}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Código postal" required error={errores.codigoPostal}>
            {(p) => <Input {...p} name="codigoPostal" value={form.codigoPostal} onChange={set('codigoPostal')} autoComplete="postal-code" placeholder="1428" />}
          </Field>
          <Field label="Teléfono" required error={errores.telefono}>
            {(p) => <Input {...p} name="telefono" type="tel" inputMode="tel" value={form.telefono} onChange={set('telefono')} autoComplete="tel" />}
          </Field>
          <Field label="WhatsApp" error={errores.whatsapp} hint="Opcional.">
            {(p) => <Input {...p} name="whatsapp" type="tel" inputMode="tel" value={form.whatsapp} onChange={set('whatsapp')} />}
          </Field>
          <Field label="Email" required error={errores.email} hint="Ahí te mandamos el acceso al panel.">
            {(p) => <Input {...p} name="email" type="email" inputMode="email" value={form.email} onChange={set('email')} autoComplete="email" />}
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="Responsable técnico y habilitación">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Óptico técnico responsable" required error={errores.opticoResponsable}>
            {(p) => <Input {...p} name="opticoResponsable" value={form.opticoResponsable} onChange={set('opticoResponsable')} autoComplete="name" />}
          </Field>
          <Field label="Matrícula" required error={errores.matricula}>
            {(p) => <Input {...p} name="matricula" value={form.matricula} onChange={set('matricula')} placeholder="MN 4521" />}
          </Field>
        </div>
        <Field label="¿Te recomendó otra óptica socia?" error={errores.referidaPorCuit} hint="Opcional: el CUIT de la óptica que te invitó.">
          {(p) => <Input {...p} name="referidaPorCuit" inputMode="numeric" placeholder="30-71234567-1" value={form.referidaPorCuit} onChange={set('referidaPorCuit')} />}
        </Field>
        <div className="font-text">
          <p className="mb-1.5 text-sm font-medium">
            Habilitación del local <span className="text-carey" aria-hidden="true">*</span>
          </p>
          <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-negro/25 px-4 py-3 text-sm hover:border-negro/50">
            <span className={habilitacion ? 'text-negro' : 'text-negro/60'}>
              {subiendo ? 'Subiendo…' : habilitacion ? `✓ ${habilitacion.nombre}` : 'Foto o PDF de la habilitación municipal (hasta 10 MB)'}
            </span>
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider underline underline-offset-4">
              {habilitacion ? 'Cambiar' : 'Adjuntar'}
            </span>
            <input
              type="file"
              name="habilitacion"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              className="sr-only"
              onChange={subir}
              disabled={subiendo}
              aria-invalid={errores.habilitacionUrl ? true : undefined}
            />
          </label>
          {errores.habilitacionUrl && (
            <p className="mt-1.5 text-sm text-carey" role="alert">
              {errores.habilitacionUrl}
            </p>
          )}
        </div>
      </Seccion>

      {/* Honeypot anti-spam: invisible para personas. */}
      <div aria-hidden="true" className="hidden">
        <label>
          Sitio web
          <input tabIndex={-1} autoComplete="off" value={form.web} onChange={set('web')} name="web" />
        </label>
      </div>

      <div>
        <Checkbox
          name="aceptaTerminos"
          checked={acepta}
          onChange={(e) => {
            setAcepta(e.target.checked);
            if (e.target.checked) setErrores(({ aceptaTerminos: _a, ...rest }) => rest);
          }}
          label={
            <>
              Leí y acepto los{' '}
              <Link href="/legal/programa-opticas" target="_blank" className="underline underline-offset-2">
                términos del programa de ópticas socias
              </Link>
              .
            </>
          }
        />
        {errores.aceptaTerminos && (
          <p className="font-text text-sm text-carey" role="alert">
            {errores.aceptaTerminos}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" loading={estado === 'enviando'} disabled={subiendo} data-testid="solicitud-enviar">
        Enviar solicitud
      </Button>
    </form>
  );
}
