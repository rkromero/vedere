'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { formatFecha, toDateInput } from '@/lib/format';
import type { PromoMensajeAdmin } from '@/lib/types';
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
} from '@/components/admin/ui';
import { Table, Td, Th, Tr } from '@/components/admin/table';
import { useToast } from '@/components/admin/toast';

interface FormState {
  texto: string;
  link: string;
  orden: string;
  activo: boolean;
  vigenciaDesde: string;
  vigenciaHasta: string;
}
const vacio: FormState = {
  texto: '',
  link: '',
  orden: '0',
  activo: true,
  vigenciaDesde: '',
  vigenciaHasta: '',
};

function dateToIso(value: string, finDeDia: boolean): string | null {
  if (!value) return null;
  return new Date(`${value}T${finDeDia ? '23:59:59.999' : '00:00:00.000'}Z`).toISOString();
}

function vigencia(desde: string | null, hasta: string | null): string {
  if (!desde && !hasta) return 'Sin límite';
  return `${desde ? formatFecha(desde) : '…'} – ${hasta ? formatFecha(hasta) : '…'}`;
}

function vigente(p: PromoMensajeAdmin): boolean {
  const now = Date.now();
  if (p.vigenciaDesde && new Date(p.vigenciaDesde).getTime() > now) return false;
  if (p.vigenciaHasta && new Date(p.vigenciaHasta).getTime() < now) return false;
  return true;
}

export function PromosTable({ items }: { items: PromoMensajeAdmin[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PromoMensajeAdmin | null>(null);
  const [form, setForm] = useState<FormState>(vacio);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<PromoMensajeAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);

  function abrir(p: PromoMensajeAdmin | null) {
    setEditing(p);
    setForm(
      p
        ? {
            texto: p.texto,
            link: p.link ?? '',
            orden: String(p.orden),
            activo: p.activo,
            vigenciaDesde: toDateInput(p.vigenciaDesde),
            vigenciaHasta: toDateInput(p.vigenciaHasta),
          }
        : { ...vacio, orden: String(items.length) },
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
      texto: form.texto.trim(),
      link: form.link.trim() || null,
      orden: Number(form.orden) || 0,
      activo: form.activo,
      vigenciaDesde: dateToIso(form.vigenciaDesde, false),
      vigenciaHasta: dateToIso(form.vigenciaHasta, true),
    };
    try {
      if (editing) {
        await api.put(`/admin/promos/${editing.id}`, payload);
        toast.ok('Mensaje actualizado');
      } else {
        await api.post('/admin/promos', payload);
        toast.ok('Mensaje creado');
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

  async function toggleActivo(p: PromoMensajeAdmin) {
    try {
      await api.put(`/admin/promos/${p.id}`, { activo: !p.activo });
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function eliminar() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/admin/promos/${toDelete.id}`);
      toast.ok('Mensaje eliminado');
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
        title="Barra de promo"
        description="Mensajes que rotan en la barra superior de la tienda. Se muestran los activos y vigentes, en orden."
        actions={<Btn onClick={() => abrir(null)}>Nuevo mensaje</Btn>}
      />

      {items.length === 0 ? (
        <EmptyState
          title="No hay mensajes"
          description="Mientras no haya mensajes, la barra usa el texto de respaldo configurado por variables de entorno."
          action={<Btn onClick={() => abrir(null)}>Nuevo mensaje</Btn>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th align="right">#</Th>
              <Th>Texto</Th>
              <Th>Enlace</Th>
              <Th>Vigencia</Th>
              <Th>Estado</Th>
              <Th align="right">Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <Tr key={p.id}>
                <Td align="right" className="text-gris-medio">
                  {p.orden}
                </Td>
                <Td className="font-medium">{p.texto}</Td>
                <Td className="text-gris-medio">{p.link ?? '—'}</Td>
                <Td>
                  {vigencia(p.vigenciaDesde, p.vigenciaHasta)}
                  {!vigente(p) && (
                    <Badge tone="warn" className="ml-2">
                      Fuera de vigencia
                    </Badge>
                  )}
                </Td>
                <Td>
                  <button type="button" onClick={() => toggleActivo(p)} title="Cambiar estado">
                    <Badge tone={p.activo ? 'ok' : 'neutral'}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </button>
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <Btn variant="ghost" size="sm" onClick={() => abrir(p)}>
                      Editar
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={() => setToDelete(p)}>
                      Eliminar
                    </Btn>
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
        title={editing ? 'Editar mensaje' : 'Nuevo mensaje'}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Btn>
            <Btn type="submit" form="promo-form" loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear mensaje'}
            </Btn>
          </>
        }
      >
        <form id="promo-form" onSubmit={guardar} className="space-y-4">
          {generalError && (
            <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{generalError}</p>
          )}
          <Field label="Texto" required error={errors.texto} hint="Máximo 140 caracteres.">
            <Input
              value={form.texto}
              onChange={(e) => setForm({ ...form, texto: e.target.value })}
              maxLength={140}
              required
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
            <Field label="Enlace" hint="Ruta interna (/envios) o URL completa." error={errors.link}>
              <Input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="/envios"
              />
            </Field>
            <Field label="Orden" error={errors.orden}>
              <Input
                type="number"
                min={0}
                value={form.orden}
                onChange={(e) => setForm({ ...form, orden: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
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
            label="Activo"
            checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={eliminar}
        title="Eliminar mensaje"
        description={toDelete ? `Se eliminará "${toDelete.texto}".` : undefined}
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  );
}
