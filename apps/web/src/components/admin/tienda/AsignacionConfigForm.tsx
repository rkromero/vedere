'use client';
// Configuración de la asignación a ópticas: plazo de aceptación en horas hábiles y horario hábil.
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { Btn, Checkbox, Field, Input } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';

export interface AsignacionConfig {
  plazoAceptacionHoras: number;
  horaHabilDesde: number;
  horaHabilHasta: number;
  sabadoHabil: boolean;
}

export function AsignacionConfigForm({ inicial, editable }: { inicial: AsignacionConfig; editable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    plazoAceptacionHoras: String(inicial.plazoAceptacionHoras),
    horaHabilDesde: String(inicial.horaHabilDesde),
    horaHabilHasta: String(inicial.horaHabilHasta),
    sabadoHabil: inicial.sabadoHabil,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.put('/admin/config-tienda', {
        plazoAceptacionHoras: Number(form.plazoAceptacionHoras),
        horaHabilDesde: Number(form.horaHabilDesde),
        horaHabilHasta: Number(form.horaHabilHasta),
        sabadoHabil: form.sabadoHabil,
      });
      toast.ok('Configuración guardada');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Plazo de aceptación (h hábiles)" error={errors.plazoAceptacionHoras} hint="Si la óptica no acepta, pasa a la siguiente.">
          <Input type="number" min={1} max={72} value={form.plazoAceptacionHoras} onChange={(e) => setForm({ ...form, plazoAceptacionHoras: e.target.value })} disabled={!editable} required />
        </Field>
        <Field label="Horario hábil desde" error={errors.horaHabilDesde} hint="Hora de Argentina (0-23).">
          <Input type="number" min={0} max={22} value={form.horaHabilDesde} onChange={(e) => setForm({ ...form, horaHabilDesde: e.target.value })} disabled={!editable} required />
        </Field>
        <Field label="Horario hábil hasta" error={errors.horaHabilHasta}>
          <Input type="number" min={1} max={23} value={form.horaHabilHasta} onChange={(e) => setForm({ ...form, horaHabilHasta: e.target.value })} disabled={!editable} required />
        </Field>
      </div>
      <Checkbox label="El sábado cuenta como día hábil" checked={form.sabadoHabil} onChange={(e) => setForm({ ...form, sabadoHabil: e.target.checked })} disabled={!editable} />
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
