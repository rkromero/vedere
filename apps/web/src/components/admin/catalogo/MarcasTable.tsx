'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { formatFecha } from '@/lib/format';
import type { Marca, Paged } from '@/lib/types';
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
import { ImagenField } from './ImagenField';

interface FormState {
  nombre: string;
  slug: string;
  logoUrl: string | null;
  activa: boolean;
}

const vacio: FormState = { nombre: '', slug: '', logoUrl: null, activa: true };

export function MarcasTable({ data }: { data: Paged<Marca> }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Marca | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(vacio);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Marca | null>(null);
  const [deleting, setDeleting] = useState(false);

  function abrirNueva() {
    setEditing(null);
    setForm(vacio);
    setErrors({});
    setGeneralError(null);
    setOpen(true);
  }

  function abrirEditar(m: Marca) {
    setEditing(m);
    setForm({ nombre: m.nombre, slug: m.slug, logoUrl: m.logoUrl, activa: m.activa });
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
      nombre: form.nombre.trim(),
      ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
      logoUrl: form.logoUrl || null,
      activa: form.activa,
    };
    try {
      if (editing) {
        await api.put(`/admin/marcas/${editing.id}`, payload);
        toast.ok('Marca actualizada');
      } else {
        await api.post('/admin/marcas', payload);
        toast.ok('Marca creada');
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
      await api.del(`/admin/marcas/${toDelete.id}`);
      toast.ok('Marca eliminada');
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
        title="Marcas"
        description="Marcas del catálogo. Una marca inactiva no se muestra en la tienda."
        actions={<Btn onClick={abrirNueva}>Nueva marca</Btn>}
      />

      <Toolbar>
        <SearchInput placeholder="Buscar marca…" />
        <FilterSelect
          param="activa"
          label="Estado"
          allLabel="Todas"
          options={[
            { value: 'true', label: 'Activas' },
            { value: 'false', label: 'Inactivas' },
          ]}
        />
      </Toolbar>

      {data.items.length === 0 ? (
        <EmptyState
          title="No hay marcas"
          description="Creá la primera marca para poder asignarla a los productos."
          action={<Btn onClick={abrirNueva}>Nueva marca</Btn>}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th className="w-16">Logo</Th>
                <Th>Nombre</Th>
                <Th>Slug</Th>
                <Th align="right">Productos</Th>
                <Th>Estado</Th>
                <Th>Actualizada</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <Tr key={m.id}>
                  <Td>
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-negro/10 bg-gris-claro text-sm font-semibold">
                      {m.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.logoUrl}
                          alt={m.nombre}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        m.nombre.charAt(0).toUpperCase()
                      )}
                    </div>
                  </Td>
                  <Td className="font-medium">{m.nombre}</Td>
                  <Td className="text-gris-medio">{m.slug}</Td>
                  <Td align="right">{m.productos ?? 0}</Td>
                  <Td>
                    <Badge tone={m.activa ? 'ok' : 'neutral'}>
                      {m.activa ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </Td>
                  <Td className="text-gris-medio">{formatFecha(m.updatedAt)}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <Btn variant="ghost" size="sm" onClick={() => abrirEditar(m)}>
                        Editar
                      </Btn>
                      <Btn variant="ghost" size="sm" onClick={() => setToDelete(m)}>
                        Eliminar
                      </Btn>
                    </div>
                  </Td>
                </Tr>
              ))}
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
        title={editing ? 'Editar marca' : 'Nueva marca'}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Btn>
            <Btn type="submit" form="marca-form" loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear marca'}
            </Btn>
          </>
        }
      >
        <form id="marca-form" onSubmit={guardar} className="space-y-4">
          {generalError && (
            <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{generalError}</p>
          )}
          <Field label="Nombre" required error={errors.nombre}>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
              autoFocus
            />
          </Field>
          <Field
            label="Slug"
            hint="Se genera a partir del nombre si lo dejás vacío."
            error={errors.slug}
          >
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="ray-ban"
            />
          </Field>
          <ImagenField
            label="Logo"
            value={form.logoUrl}
            onChange={(logoUrl) => setForm({ ...form, logoUrl })}
            folder="marcas"
            tamano="urlMediana"
            error={errors.logoUrl}
          />
          <Checkbox
            label="Marca activa"
            checked={form.activa}
            onChange={(e) => setForm({ ...form, activa: e.target.checked })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={eliminar}
        title="Eliminar marca"
        description={
          toDelete
            ? `Se eliminará "${toDelete.nombre}". Los productos asociados quedan sin marca. Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  );
}
