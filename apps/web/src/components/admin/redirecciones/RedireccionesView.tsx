'use client';
// Redirecciones 301/302 administrables (sólo ADMIN): tabla + alta/edición/baja en modal.
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { Badge, Btn, Checkbox, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader } from '@/components/admin/ui';
import { Table, Td, Th, Tr } from '@/components/admin/table';
import { useToast } from '@/components/admin/toast';
import { formatFecha } from '@/lib/format';
import type { Redireccion } from '@/lib/admin/prompt6';

const vacio = { origen: '', destino: '', permanente: true, activa: true };

export function RedireccionesView({ items }: { items: Redireccion[] | null }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Redireccion | 'nueva' | null>(null);
  const [form, setForm] = useState(vacio);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Redireccion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filtro, setFiltro] = useState('');

  function abrir(r: Redireccion | 'nueva') {
    setEditing(r);
    setErrors({});
    setForm(r === 'nueva' ? vacio : { origen: r.origen, destino: r.destino, permanente: r.permanente, activa: r.activa });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = { origen: form.origen.trim(), destino: form.destino.trim(), permanente: form.permanente, activa: form.activa };
    try {
      if (editing === 'nueva') await api.post('/admin/redirecciones', body);
      else if (editing) await api.put(`/admin/redirecciones/${editing.id}`, body);
      toast.ok(editing === 'nueva' ? 'Redirección creada' : 'Redirección guardada');
      setEditing(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/admin/redirecciones/${toDelete.id}`);
      toast.ok('Redirección eliminada');
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  async function alternarActiva(r: Redireccion) {
    try {
      await api.put(`/admin/redirecciones/${r.id}`, { activa: !r.activa });
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const lista = (items ?? []).filter((r) => {
    const q = filtro.trim().toLowerCase();
    return !q || r.origen.toLowerCase().includes(q) || r.destino.toLowerCase().includes(q);
  });

  return (
    <>
      <PageHeader
        title="Redirecciones"
        description="URLs viejas que redirigen a nuevas (301 permanente o 302 temporal). Se aplican en toda la tienda; los cambios tardan hasta un minuto en verse."
        actions={<Btn onClick={() => abrir('nueva')}>Nueva redirección</Btn>}
      />
      {!items ? (
        <EmptyState title="No se pudieron cargar las redirecciones" description="La API no respondió a /admin/redirecciones." />
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin redirecciones"
          description="Creá una cuando cambies la URL de un producto, una colección o una página para no perder tráfico."
          action={<Btn onClick={() => abrir('nueva')}>Nueva redirección</Btn>}
        />
      ) : (
        <>
          <div className="mb-4">
            <Input placeholder="Filtrar por origen o destino…" value={filtro} onChange={(e) => setFiltro(e.target.value)} className="sm:w-72" />
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Origen</Th>
                <Th>Destino</Th>
                <Th>Tipo</Th>
                <Th align="right">Hits</Th>
                <Th>Estado</Th>
                <Th>Creada</Th>
                <Th align="right"> </Th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-mono text-xs">{r.origen}</Td>
                  <Td className="font-mono text-xs">{r.destino}</Td>
                  <Td>
                    <Badge tone={r.permanente ? 'info' : 'neutral'}>{r.permanente ? '301' : '302'}</Badge>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {r.hits}
                  </Td>
                  <Td>
                    <button type="button" onClick={() => void alternarActiva(r)} title="Activar / desactivar">
                      <Badge tone={r.activa ? 'ok' : 'warn'}>{r.activa ? 'Activa' : 'Inactiva'}</Badge>
                    </button>
                  </Td>
                  <Td className="text-gris-medio">{formatFecha(r.createdAt)}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <Btn size="sm" variant="ghost" onClick={() => abrir(r)}>
                        Editar
                      </Btn>
                      <Btn size="sm" variant="ghost" className="text-carey" onClick={() => setToDelete(r)}>
                        Eliminar
                      </Btn>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {lista.length === 0 && <p className="mt-3 text-sm text-gris-medio">Nada coincide con el filtro.</p>}
        </>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'nueva' ? 'Nueva redirección' : 'Editar redirección'} size="sm">
        <form onSubmit={guardar} className="space-y-4">
          <Field label="Origen" error={errors.origen} required hint="Ruta vieja, empieza con / (ej. /anteojos-de-sol).">
            <Input value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })} required placeholder="/ruta-vieja" className="font-mono" />
          </Field>
          <Field label="Destino" error={errors.destino} required hint="Ruta nueva o URL completa.">
            <Input value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} required placeholder="/sol" className="font-mono" />
          </Field>
          <Checkbox label="Permanente (301). Desmarcá para temporal (302)." checked={form.permanente} onChange={(e) => setForm({ ...form, permanente: e.target.checked })} />
          <Checkbox label="Activa" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} />
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Btn>
            <Btn type="submit" loading={saving}>
              Guardar
            </Btn>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void eliminar()}
        title="Eliminar redirección"
        description={toDelete ? `${toDelete.origen} dejará de redirigir a ${toDelete.destino}.` : undefined}
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  );
}
