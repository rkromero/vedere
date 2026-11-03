'use client';
// Agenda simple de turnos de la óptica: medición, ajuste, retiro. Lista por fecha + alta/edición/baja.
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { formatFecha } from '@/lib/format';
import { ESTADO_TURNO_LABEL, TIPO_TURNO_LABEL } from '@/lib/pedidos';
import type { EstadoTurno, TipoTurno, Turno } from '@/lib/pedidos';
import { Badge, Btn, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/admin/ui';
import { FilterSelect, Table, Td, Th, Toolbar, Tr, useQueryParams } from '@/components/admin/table';
import { useToast } from '@/components/admin/toast';

interface FormState {
  pedidoId: string;
  tipo: TipoTurno;
  fecha: string;
  duracionMin: string;
  clienteNombre: string;
  clienteTelefono: string;
  notas: string;
  estado: EstadoTurno;
}

/** Fecha local (hora Argentina) → valor para <input type="datetime-local">. */
function aLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000);
  return d.toISOString().slice(0, 16);
}
/** Valor del input (hora Argentina) → ISO UTC. */
function deLocal(v: string): string {
  return new Date(`${v}:00-03:00`).toISOString();
}

const vacio = (): FormState => ({
  pedidoId: '',
  tipo: 'MEDICION',
  fecha: '',
  duracionMin: '30',
  clienteNombre: '',
  clienteTelefono: '',
  notas: '',
  estado: 'PROGRAMADO',
});

export function TurnosAgenda({ turnos, prefill }: { turnos: Turno[]; prefill: { pedidoId: string; nombre: string; telefono: string } }) {
  const router = useRouter();
  const toast = useToast();
  const { get, set } = useQueryParams();
  const [open, setOpen] = useState(!!prefill.pedidoId);
  const [editing, setEditing] = useState<Turno | null>(null);
  const [form, setForm] = useState<FormState>(() => ({ ...vacio(), pedidoId: prefill.pedidoId, clienteNombre: prefill.nombre, clienteTelefono: prefill.telefono }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Turno | null>(null);
  const [deleting, setDeleting] = useState(false);

  function abrir(t: Turno | null) {
    setEditing(t);
    setForm(
      t
        ? {
            pedidoId: t.pedidoId ?? '',
            tipo: t.tipo,
            fecha: aLocal(t.fecha),
            duracionMin: String(t.duracionMin),
            clienteNombre: t.clienteNombre,
            clienteTelefono: t.clienteTelefono ?? '',
            notas: t.notas ?? '',
            estado: t.estado,
          }
        : vacio(),
    );
    setErrors({});
    setGeneral(null);
    setOpen(true);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setGeneral(null);
    const payload = {
      pedidoId: form.pedidoId.trim() || null,
      tipo: form.tipo,
      fecha: form.fecha ? deLocal(form.fecha) : '',
      duracionMin: Number(form.duracionMin) || 30,
      clienteNombre: form.clienteNombre.trim(),
      clienteTelefono: form.clienteTelefono.trim() || null,
      notas: form.notas.trim() || null,
      estado: form.estado,
    };
    try {
      if (editing) {
        await api.put(`/optica/turnos/${editing.id}`, payload);
        toast.ok('Turno actualizado');
      } else {
        await api.post('/optica/turnos', payload);
        toast.ok('Turno agendado');
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setGeneral(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/optica/turnos/${toDelete.id}`);
      toast.ok('Turno eliminado');
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  async function marcar(t: Turno, estado: EstadoTurno) {
    try {
      await api.put(`/optica/turnos/${t.id}`, { estado });
      toast.ok(estado === 'REALIZADO' ? 'Turno realizado' : 'Turno cancelado');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader
        title="Agenda de turnos"
        description="Turnos de medición, ajuste y retiro. Vinculá cada turno a un pedido para verlo en su detalle."
        actions={<Btn onClick={() => abrir(null)}>Nuevo turno</Btn>}
      />
      <Toolbar>
        <FilterSelect param="estado" label="Estado" options={Object.entries(ESTADO_TURNO_LABEL).map(([value, label]) => ({ value, label }))} />
        <label className="flex items-center gap-2 text-xs text-gris-medio">
          Desde
          <Input type="date" value={get('desde')} onChange={(e) => set({ desde: e.target.value || undefined })} className="h-10 w-40" aria-label="Desde" />
        </label>
        <label className="flex items-center gap-2 text-xs text-gris-medio">
          Hasta
          <Input type="date" value={get('hasta')} onChange={(e) => set({ hasta: e.target.value || undefined })} className="h-10 w-40" aria-label="Hasta" />
        </label>
        <button type="button" onClick={() => set({ desde: hoy, hasta: undefined, estado: 'PROGRAMADO' })} className="text-xs underline underline-offset-2">
          Próximos
        </button>
      </Toolbar>

      {turnos.length === 0 ? (
        <EmptyState title="Sin turnos" description="Agendá el primer turno de medición o ajuste." action={<Btn onClick={() => abrir(null)}>Nuevo turno</Btn>} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Tipo</Th>
              <Th>Cliente</Th>
              <Th>Pedido</Th>
              <Th>Estado</Th>
              <Th align="right">Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {turnos.map((t) => (
              <Tr key={t.id}>
                <Td>
                  <span className="font-medium">{formatFecha(t.fecha, true)}</span>
                  <span className="block text-xs text-gris-medio">{t.duracionMin} min</span>
                </Td>
                <Td>{TIPO_TURNO_LABEL[t.tipo]}</Td>
                <Td>
                  {t.clienteNombre}
                  {t.clienteTelefono && <span className="block text-xs text-gris-medio">{t.clienteTelefono}</span>}
                  {t.notas && <span className="block text-xs text-gris-medio">{t.notas}</span>}
                </Td>
                <Td>
                  {t.pedido ? (
                    <Link href={`/optica/pedidos/${t.pedido.id}`} className="font-mono text-xs underline-offset-2 hover:underline">
                      {t.pedido.numero}
                    </Link>
                  ) : (
                    <span className="text-gris-medio">—</span>
                  )}
                </Td>
                <Td>
                  <Badge tone={t.estado === 'REALIZADO' ? 'ok' : t.estado === 'CANCELADO' ? 'neutral' : 'info'}>{ESTADO_TURNO_LABEL[t.estado]}</Badge>
                </Td>
                <Td align="right">
                  <div className="flex flex-wrap justify-end gap-1">
                    {t.estado === 'PROGRAMADO' && (
                      <>
                        <Btn variant="ghost" size="sm" onClick={() => marcar(t, 'REALIZADO')}>Realizado</Btn>
                        <Btn variant="ghost" size="sm" onClick={() => marcar(t, 'CANCELADO')}>Cancelar</Btn>
                      </>
                    )}
                    <Btn variant="ghost" size="sm" onClick={() => abrir(t)}>Editar</Btn>
                    <Btn variant="ghost" size="sm" onClick={() => setToDelete(t)}>Eliminar</Btn>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar turno' : 'Nuevo turno'}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setOpen(false)}>Cancelar</Btn>
            <Btn type="submit" form="turno-form" loading={saving}>{editing ? 'Guardar' : 'Agendar'}</Btn>
          </>
        }
      >
        <form id="turno-form" onSubmit={guardar} className="space-y-4">
          {general && <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{general}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo" required error={errors.tipo}>
              <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoTurno })}>
                {Object.entries(TIPO_TURNO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Fecha y hora" required error={errors.fecha}>
              <Input type="datetime-local" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
            </Field>
            <Field label="Cliente" required error={errors.clienteNombre}>
              <Input value={form.clienteNombre} onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })} required />
            </Field>
            <Field label="Teléfono" error={errors.clienteTelefono}>
              <Input value={form.clienteTelefono} onChange={(e) => setForm({ ...form, clienteTelefono: e.target.value })} inputMode="tel" />
            </Field>
            <Field label="Duración (min)" error={errors.duracionMin}>
              <Input type="number" min={10} max={240} step={5} value={form.duracionMin} onChange={(e) => setForm({ ...form, duracionMin: e.target.value })} />
            </Field>
            <Field label="Pedido (id)" error={errors.pedidoId} hint="Se completa solo desde el botón Agendar turno del pedido.">
              <Input value={form.pedidoId} onChange={(e) => setForm({ ...form, pedidoId: e.target.value })} className="font-mono text-xs" />
            </Field>
            {editing && (
              <Field label="Estado" error={errors.estado}>
                <Select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoTurno })}>
                  {Object.entries(ESTADO_TURNO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
            )}
          </div>
          <Field label="Notas" error={errors.notas}>
            <Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="min-h-[64px]" />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={eliminar}
        title="Eliminar turno"
        description={toDelete ? `Se elimina el turno de ${toDelete.clienteNombre} del ${formatFecha(toDelete.fecha, true)}.` : undefined}
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  );
}
