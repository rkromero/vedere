'use client';
// Datos fiscales (footer y emails) y programas: Plan Rivedere, referidos y carrito abandonado (prompt 6).
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { Btn, Checkbox, Field, Input, Select } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';
import type { TiendaConfigFiscal } from '@/lib/admin/prompt6';

const CONDICIONES_IVA = ['Responsable Inscripto', 'Monotributo', 'Exento', 'Consumidor Final'];

export function TiendaConfigForm({ inicial, editable }: { inicial: TiendaConfigFiscal; editable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    razonSocial: inicial.razonSocial ?? '',
    cuit: inicial.cuit ?? '',
    domicilioFiscal: inicial.domicilioFiscal ?? '',
    condicionIva: inicial.condicionIva ?? '',
    ingresosBrutos: inicial.ingresosBrutos ?? '',
    inicioActividades: inicial.inicioActividades ?? '',
    emailContacto: inicial.emailContacto ?? '',
    rivedereMeses: String(inicial.rivedereMeses ?? 24),
    rivedereDescuentoPct: String(inicial.rivedereDescuentoPct ?? 15),
    referidoDescuentoPct: String(inicial.referidoDescuentoPct ?? 10),
    carritoAbandonadoHabilitado: inicial.carritoAbandonadoHabilitado ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const txt = (v: string) => v.trim() || null;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.put('/admin/config-tienda', {
        razonSocial: txt(form.razonSocial),
        cuit: txt(form.cuit),
        domicilioFiscal: txt(form.domicilioFiscal),
        condicionIva: txt(form.condicionIva),
        ingresosBrutos: txt(form.ingresosBrutos),
        inicioActividades: txt(form.inicioActividades),
        emailContacto: txt(form.emailContacto),
        rivedereMeses: Number(form.rivedereMeses),
        rivedereDescuentoPct: Number(form.rivedereDescuentoPct),
        referidoDescuentoPct: Number(form.referidoDescuentoPct),
        carritoAbandonadoHabilitado: form.carritoAbandonadoHabilitado,
      });
      toast.ok('Datos guardados');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const dis = !editable;
  return (
    <form onSubmit={guardar} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-gris-medio">Datos fiscales (footer y emails)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Razón social" error={errors.razonSocial}>
            <Input value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} disabled={dis} maxLength={160} />
          </Field>
          <Field label="CUIT" error={errors.cuit} hint="Formato 30-12345678-9.">
            <Input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} disabled={dis} maxLength={13} placeholder="30-00000000-0" />
          </Field>
          <Field label="Domicilio fiscal" error={errors.domicilioFiscal} className="sm:col-span-2">
            <Input value={form.domicilioFiscal} onChange={(e) => setForm({ ...form, domicilioFiscal: e.target.value })} disabled={dis} maxLength={200} />
          </Field>
          <Field label="Condición frente al IVA" error={errors.condicionIva}>
            <Select value={form.condicionIva} onChange={(e) => setForm({ ...form, condicionIva: e.target.value })} disabled={dis}>
              <option value="">—</option>
              {CONDICIONES_IVA.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ingresos Brutos" error={errors.ingresosBrutos} hint="Número de inscripción o “Convenio Multilateral”.">
            <Input value={form.ingresosBrutos} onChange={(e) => setForm({ ...form, ingresosBrutos: e.target.value })} disabled={dis} maxLength={60} />
          </Field>
          <Field label="Inicio de actividades" error={errors.inicioActividades} hint="Como figura en AFIP, ej. 01/03/2026.">
            <Input value={form.inicioActividades} onChange={(e) => setForm({ ...form, inicioActividades: e.target.value })} disabled={dis} maxLength={20} />
          </Field>
          <Field label="Email de contacto" error={errors.emailContacto} hint="Aparece en el footer y en el pie de los emails.">
            <Input type="email" value={form.emailContacto} onChange={(e) => setForm({ ...form, emailContacto: e.target.value })} disabled={dis} maxLength={160} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-gris-medio">Programas</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Plan Rivedere: meses" error={errors.rivedereMeses} hint="Desde la última compra de recetado o multifocal se manda el recordatorio con cupón.">
            <Input type="number" min={1} max={120} value={form.rivedereMeses} onChange={(e) => setForm({ ...form, rivedereMeses: e.target.value })} disabled={dis} required />
          </Field>
          <Field label="Plan Rivedere: descuento %" error={errors.rivedereDescuentoPct}>
            <Input type="number" min={0} max={100} step="0.5" value={form.rivedereDescuentoPct} onChange={(e) => setForm({ ...form, rivedereDescuentoPct: e.target.value })} disabled={dis} required />
          </Field>
          <Field label="Referidos: descuento %" error={errors.referidoDescuentoPct} hint="Cupón para quien refiere y para el referido cuando este compra.">
            <Input type="number" min={0} max={100} step="0.5" value={form.referidoDescuentoPct} onChange={(e) => setForm({ ...form, referidoDescuentoPct: e.target.value })} disabled={dis} required />
          </Field>
        </div>
        <Checkbox
          label="Emails de carrito abandonado (a la hora y a las 24 horas) a clientes con cuenta"
          checked={form.carritoAbandonadoHabilitado}
          onChange={(e) => setForm({ ...form, carritoAbandonadoHabilitado: e.target.checked })}
          disabled={dis}
        />
      </fieldset>

      {editable ? (
        <Btn type="submit" size="sm" loading={saving}>
          Guardar
        </Btn>
      ) : (
        <p className="text-xs text-gris-medio">Sólo los administradores pueden cambiar estos valores.</p>
      )}
    </form>
  );
}
