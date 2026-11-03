'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { formatFecha, formatPrecio, toDateInput } from '@/lib/format';
import type { Cupon, Paged, TipoCupon } from '@/lib/types';
import {
  Badge,
  Btn,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
} from '@/components/admin/ui';
import {
  FilterSelect,
  Pagination,
  SearchInput,
  Table,
  Td,
  Th,
  Toolbar,
  Tr,
} from '@/components/admin/table';
import { useToast } from '@/components/admin/toast';

interface FormState {
  codigo: string;
  descripcion: string;
  tipo: TipoCupon;
  valor: string;
  minimoCompra: string;
  usosMax: string;
  activo: boolean;
  vigenciaDesde: string;
  vigenciaHasta: string;
}
const vacio: FormState = {
  codigo: '',
  descripcion: '',
  tipo: 'PORCENTAJE',
  valor: '',
  minimoCompra: '',
  usosMax: '',
  activo: true,
  vigenciaDesde: '',
  vigenciaHasta: '',
};

function dateToIso(value: string, finDeDia: boolean): string | null {
  if (!value) return null;
  return new Date(`${value}T${finDeDia ? '23:59:59.999' : '00:00:00.000'}Z`).toISOString();
}
const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

function vigencia(desde: string | null, hasta: string | null): string {
  if (!desde && !hasta) return 'Sin límite';
  return `${desde ? formatFecha(desde) : '…'} – ${hasta ? formatFecha(hasta) : '…'}`;
}

function estado(c: Cupon): { tone: 'ok' | 'neutral' | 'warn' | 'danger'; label: string } {
  if (!c.activo) return { tone: 'neutral', label: 'Inactivo' };
  const now = Date.now();
  if (c.vigenciaDesde && new Date(c.vigenciaDesde).getTime() > now)
    return { tone: 'warn', label: 'Pendiente' };
  if (c.vigenciaHasta && new Date(c.vigenciaHasta).getTime() < now)
    return { tone: 'danger', label: 'Vencido' };
  if (c.usosMax !== null && c.usos >= c.usosMax) return { tone: 'danger', label: 'Agotado' };
  return { tone: 'ok', label: 'Vigente' };
}

export function CuponesTable({ data }: { data: Paged<Cupon> }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cupon | null>(null);
  const [form, setForm] = useState<FormState>(vacio);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Cupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  function abrir(c: Cupon | null) {
    setEditing(c);
    setForm(
      c
        ? {
            codigo: c.codigo,
            descripcion: c.descripcion ?? '',
            tipo: c.tipo,
            valor: String(c.valor),
            minimoCompra: c.minimoCompra === null ? '' : String(c.minimoCompra),
            usosMax: c.usosMax === null ? '' : String(c.usosMax),
            activo: c.activo,
            vigenciaDesde: toDateInput(c.vigenciaDesde),
            vigenciaHasta: toDateInput(c.vigenciaHasta),
          }
        : vacio,
    );
    setErrors({});
    setGeneralError(null);
    setOpen(true);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setGeneralError(null);
    const payload = {
      codigo: form.codigo.trim().toUpperCase(),
      descripcion: form.descripcion.trim() || null,
      tipo: form.tipo,
      valor: Number(form.valor),
      minimoCompra: numOrNull(form.minimoCompra),
      usosMax: numOrNull(form.usosMax),
      activo: form.activo,
      vigenciaDesde: dateToIso(form.vigenciaDesde, false),
      vigenciaHasta: dateToIso(form.vigenciaHasta, true),
    };
    try {
      if (editing) {
        await api.put(`/admin/cupones/${editing.id}`, payload);
        toast.ok('Cupón actualizado');
      } else {
        await api.post('/admin/cupones', payload);
        toast.ok('Cupón creado');
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setGeneralError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/admin/cupones/${toDelete.id}`);
      toast.ok('Cupón eliminado');
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Cupones"
        description="Descuentos por código que se aplican en el carrito. Los usos se descuentan al confirmar el pedido."
        actions={<Btn onClick={() => abrir(null)}>Nuevo cupón</Btn>}
      />

      <Toolbar>
        <SearchInput placeholder="Buscar código…" />
        <FilterSelect
          param="activo"
          label="Estado"
          allLabel="Todos"
          options={[
            { value: 'true', label: 'Activos' },
            { value: 'false', label: 'Inactivos' },
          ]}
        />
      </Toolbar>

      {data.items.length === 0 ? (
        <EmptyState
          title="No hay cupones"
          description="Creá un código de descuento para usarlo en campañas."
          action={<Btn onClick={() => abrir(null)}>Nuevo cupón</Btn>}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Descuento</Th>
                <Th>Mínimo</Th>
                <Th>Vigencia</Th>
                <Th align="right">Usos</Th>
                <Th>Estado</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => {
                const st = estado(c);
                return (
                  <Tr key={c.id}>
                    <Td>
                      <p className="font-mono font-medium">{c.codigo}</p>
                      {c.descripcion && <p className="text-xs text-gris-medio">{c.descripcion}</p>}
                    </Td>
                    <Td>{c.tipo === 'PORCENTAJE' ? `${c.valor}%` : formatPrecio(c.valor)}</Td>
                    <Td>{c.minimoCompra !== null ? formatPrecio(c.minimoCompra) : '—'}</Td>
                    <Td className="text-xs">{vigencia(c.vigenciaDesde, c.vigenciaHasta)}</Td>
                    <Td align="right">
                      {c.usos}
                      {c.usosMax !== null && (
                        <span className="text-gris-medio"> / {c.usosMax}</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1">
                        <Btn variant="ghost" size="sm" onClick={() => abrir(c)}>
                          Editar
                        </Btn>
                        <Btn variant="ghost" size="sm" onClick={() => setToDelete(c)}>
                          Eliminar
                        </Btn>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
          />
        </>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar cupón' : 'Nuevo cupón'}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Btn>
            <Btn type="submit" form="cupon-form" loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear cupón'}
            </Btn>
          </>
        }
      >
        <form id="cupon-form" onSubmit={guardar} className="space-y-4">
          {generalError && (
            <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{generalError}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Código"
              required
              error={errors.codigo}
              hint="Letras, números, - y _. Se guarda en mayúsculas."
            >
              <Input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                className="font-mono uppercase"
                maxLength={30}
                required
                autoFocus
              />
            </Field>
            <Field label="Descripción" error={errors.descripcion}>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                maxLength={140}
              />
            </Field>
            <Field label="Tipo" required error={errors.tipo}>
              <Select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoCupon })}
              >
                <option value="PORCENTAJE">Porcentaje</option>
                <option value="MONTO">Monto fijo</option>
              </Select>
            </Field>
            <Field
              label={form.tipo === 'PORCENTAJE' ? 'Porcentaje' : 'Monto ($)'}
              required
              error={errors.valor}
            >
              <Input
                type="number"
                min={0}
                max={form.tipo === 'PORCENTAJE' ? 100 : undefined}
                step={form.tipo === 'PORCENTAJE' ? 1 : 0.01}
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                required
              />
            </Field>
            <Field label="Compra mínima ($)" error={errors.minimoCompra} hint="Vacío = sin mínimo.">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.minimoCompra}
                onChange={(e) => setForm({ ...form, minimoCompra: e.target.value })}
              />
            </Field>
            <Field label="Usos máximos" error={errors.usosMax} hint="Vacío = ilimitado.">
              <Input
                type="number"
                min={1}
                step={1}
                value={form.usosMax}
                onChange={(e) => setForm({ ...form, usosMax: e.target.value })}
              />
            </Field>
            <Field label="Vigencia desde" error={errors.vigenciaDesde}>
              <Input
                type="date"
                value={form.vigenciaDesde}
                onChange={(e) => setForm({ ...form, vigenciaDesde: e.target.value })}
              />
            </Field>
            <Field label="Vigencia hasta" error={errors.vigenciaHasta}>
              <Input
                type="date"
                value={form.vigenciaHasta}
                min={form.vigenciaDesde || undefined}
                onChange={(e) => setForm({ ...form, vigenciaHasta: e.target.value })}
              />
            </Field>
          </div>
          <Checkbox
            label="Cupón activo"
            checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={eliminar}
        title="Eliminar cupón"
        description={toDelete ? `Se eliminará el cupón ${toDelete.codigo}.` : undefined}
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  );
}
