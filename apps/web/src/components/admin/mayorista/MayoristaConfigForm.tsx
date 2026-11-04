'use client';
// Configuración del canal mayorista: IVA, compra mínima general (cada óptica puede tener la suya en
// Ópticas), envío por transporte (costo fijo o a cargo de la óptica) y retiro en el depósito.
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import type { ConfigMayorista } from '@/lib/mayorista';
import { Btn, Checkbox, Field, Input, Select } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';

const num = (s: string) => Number(s.replace(',', '.')) || 0;

export function MayoristaConfigForm({ inicial, editable }: { inicial: ConfigMayorista; editable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    ivaPct: String(inicial.ivaPct),
    minimoTipo: inicial.minimoTipo,
    minimoValor: String(inicial.minimoValor),
    envioHabilitado: inicial.envioHabilitado,
    envioModo: inicial.envioModo,
    envioCosto: String(inicial.envioCosto),
    retiroHabilitado: inicial.retiroHabilitado,
    retiroDireccion: inicial.retiroDireccion ?? '',
    retiroHorario: inicial.retiroHorario ?? '',
    diasToleranciaVencida: String(inicial.diasToleranciaVencida ?? 7),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.put('/admin/mayorista/config', {
        ivaPct: num(form.ivaPct),
        minimoTipo: form.minimoTipo,
        minimoValor: form.minimoTipo === 'NINGUNO' ? 0 : num(form.minimoValor),
        envioHabilitado: form.envioHabilitado,
        envioModo: form.envioModo,
        envioCosto: form.envioModo === 'COSTO_FIJO' ? num(form.envioCosto) : 0,
        retiroHabilitado: form.retiroHabilitado,
        retiroDireccion: form.retiroDireccion.trim() || null,
        retiroHorario: form.retiroHorario.trim() || null,
        diasToleranciaVencida: Number(form.diasToleranciaVencida) || 0,
      });
      toast.ok('Configuración mayorista guardada');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const d = !editable;
  return (
    <form onSubmit={guardar} className="space-y-5" data-testid="config-mayorista">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Alícuota de IVA (%)" error={errors.ivaPct} hint="Se suma al precio mayorista (sin IVA).">
          <Input value={form.ivaPct} onChange={(e) => set('ivaPct', e.target.value)} inputMode="decimal" disabled={d} />
        </Field>
        <Field label="Compra mínima general" error={errors.minimoTipo} hint="Cada óptica puede tener la suya (en Ópticas).">
          <Select value={form.minimoTipo} onChange={(e) => set('minimoTipo', e.target.value as ConfigMayorista['minimoTipo'])} disabled={d}>
            <option value="NINGUNO">Sin mínimo</option>
            <option value="UNIDADES">Por unidades</option>
            <option value="MONTO">Por monto (sin IVA)</option>
          </Select>
        </Field>
        {form.minimoTipo !== 'NINGUNO' && (
          <Field label={form.minimoTipo === 'UNIDADES' ? 'Unidades mínimas' : 'Monto mínimo ($ sin IVA)'} error={errors.minimoValor}>
            <Input value={form.minimoValor} onChange={(e) => set('minimoValor', e.target.value)} inputMode="decimal" disabled={d} />
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-negro/10 p-4">
          <Checkbox label="Envío por transporte a la dirección de la óptica" checked={form.envioHabilitado} onChange={(e) => set('envioHabilitado', e.target.checked)} disabled={d} />
          {form.envioHabilitado && (
            <>
              <Field label="Costo del envío">
                <Select value={form.envioModo} onChange={(e) => set('envioModo', e.target.value as ConfigMayorista['envioModo'])} disabled={d}>
                  <option value="A_CARGO_OPTICA">A cargo de la óptica (paga al recibir)</option>
                  <option value="COSTO_FIJO">Costo fijo que se suma al pedido</option>
                </Select>
              </Field>
              {form.envioModo === 'COSTO_FIJO' && (
                <Field label="Costo fijo ($ sin IVA)" error={errors.envioCosto}>
                  <Input value={form.envioCosto} onChange={(e) => set('envioCosto', e.target.value)} inputMode="decimal" disabled={d} />
                </Field>
              )}
            </>
          )}
        </div>
        <div className="space-y-3 rounded-lg border border-negro/10 p-4">
          <Checkbox label="Retiro en el depósito" checked={form.retiroHabilitado} onChange={(e) => set('retiroHabilitado', e.target.checked)} disabled={d} />
          {form.retiroHabilitado && (
            <>
              <Field label="Dirección del depósito" required error={errors.retiroDireccion}>
                <Input value={form.retiroDireccion} onChange={(e) => set('retiroDireccion', e.target.value)} disabled={d} placeholder="Av. Warnes 1200, CABA" />
              </Field>
              <Field label="Horario de retiro" error={errors.retiroHorario}>
                <Input value={form.retiroHorario} onChange={(e) => set('retiroHorario', e.target.value)} disabled={d} placeholder="Lunes a viernes de 9 a 17" />
              </Field>
            </>
          )}
        </div>
      </div>
      {errors.retiroHabilitado && <p className="text-sm text-carey">{errors.retiroHabilitado}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Tolerancia de deuda vencida (días)"
          error={errors.diasToleranciaVencida}
          hint="Con deuda vencida hace más días que esto, los pedidos nuevos quedan en revisión."
        >
          <Input
            type="number"
            min={0}
            max={90}
            value={form.diasToleranciaVencida}
            onChange={(e) => set('diasToleranciaVencida', e.target.value)}
            disabled={d}
            data-testid="config-tolerancia"
          />
        </Field>
      </div>

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
