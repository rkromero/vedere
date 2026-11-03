'use client';
import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import type { OpticaAdmin, Paged } from '@/lib/types';
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
  Textarea,
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
  nombre: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  lat: string;
  lng: string;
  telefono: string;
  whatsapp: string;
  email: string;
  horarios: string;
  orden: string;
  activa: boolean;
}
const vacio: FormState = {
  nombre: '',
  direccion: '',
  localidad: '',
  provincia: 'Buenos Aires',
  codigoPostal: '',
  lat: '',
  lng: '',
  telefono: '',
  whatsapp: '',
  email: '',
  horarios: '',
  orden: '0',
  activa: true,
};

const num = (s: string): number | null => (s.trim() === '' ? null : Number(s.replace(',', '.')));

export function OpticasTable({
  data,
  provincias,
}: {
  data: Paged<OpticaAdmin>;
  provincias: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OpticaAdmin | null>(null);
  const [form, setForm] = useState<FormState>(vacio);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<OpticaAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);

  function abrir(o: OpticaAdmin | null) {
    setEditing(o);
    setForm(
      o
        ? {
            nombre: o.nombre,
            direccion: o.direccion,
            localidad: o.localidad,
            provincia: o.provincia,
            codigoPostal: o.codigoPostal,
            lat: o.lat === null ? '' : String(o.lat),
            lng: o.lng === null ? '' : String(o.lng),
            telefono: o.telefono ?? '',
            whatsapp: o.whatsapp ?? '',
            email: o.email ?? '',
            horarios: o.horarios ?? '',
            orden: String(o.orden),
            activa: o.activa,
          }
        : vacio,
    );
    setErrors({});
    setGeneralError(null);
    setOpen(true);
  }

  const f = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setGeneralError(null);
    const latN = num(form.lat);
    const lngN = num(form.lng);
    if ((latN !== null && Number.isNaN(latN)) || (lngN !== null && Number.isNaN(lngN))) {
      setErrors({ lat: 'Coordenadas inválidas' });
      setSaving(false);
      return;
    }
    const payload = {
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim(),
      localidad: form.localidad.trim(),
      provincia: form.provincia.trim(),
      codigoPostal: form.codigoPostal.trim(),
      lat: latN,
      lng: lngN,
      telefono: form.telefono.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      horarios: form.horarios.trim() || null,
      orden: Number(form.orden) || 0,
      activa: form.activa,
    };
    try {
      if (editing) {
        await api.put(`/admin/opticas/${editing.id}`, payload);
        toast.ok('Óptica actualizada');
      } else {
        await api.post('/admin/opticas', payload);
        toast.ok('Óptica creada');
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
      await api.del(`/admin/opticas/${toDelete.id}`);
      toast.ok('Óptica eliminada');
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
        title="Ópticas socias"
        description="Red de ópticas que arman, entregan y ajustan los pedidos. Con coordenadas aparecen en el mapa de la tienda."
        actions={<Btn onClick={() => abrir(null)}>Nueva óptica</Btn>}
      />

      <Toolbar>
        <SearchInput placeholder="Buscar por nombre, localidad o CP…" />
        <FilterSelect
          param="provincia"
          label="Provincia"
          allLabel="Todas"
          options={provincias.map((p) => ({ value: p, label: p }))}
        />
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
          title="No hay ópticas"
          description="Cargá la primera óptica socia para que aparezca en el buscador por código postal."
          action={<Btn onClick={() => abrir(null)}>Nueva óptica</Btn>}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Óptica</Th>
                <Th>Dirección</Th>
                <Th>CP</Th>
                <Th>Contacto</Th>
                <Th>Mapa</Th>
                <Th>Estado</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <p className="font-medium">{o.nombre}</p>
                    <p className="text-xs text-gris-medio">{o.slug}</p>
                  </Td>
                  <Td>
                    {o.direccion}
                    <span className="block text-xs text-gris-medio">
                      {o.localidad}, {o.provincia}
                    </span>
                  </Td>
                  <Td className="font-mono text-xs">{o.codigoPostal}</Td>
                  <Td className="text-xs">
                    {o.whatsapp && <span className="block">WA {o.whatsapp}</span>}
                    {o.telefono && <span className="block">Tel {o.telefono}</span>}
                    {o.email && <span className="block text-gris-medio">{o.email}</span>}
                    {!o.whatsapp && !o.telefono && !o.email && '—'}
                  </Td>
                  <Td>
                    <Badge tone={o.lat !== null && o.lng !== null ? 'ok' : 'warn'}>
                      {o.lat !== null && o.lng !== null ? 'Con coordenadas' : 'Sin coordenadas'}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={o.activa ? 'ok' : 'neutral'}>
                      {o.activa ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <Btn variant="ghost" size="sm" onClick={() => abrir(o)}>
                        Editar
                      </Btn>
                      <Btn variant="ghost" size="sm" onClick={() => setToDelete(o)}>
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
        title={editing ? 'Editar óptica' : 'Nueva óptica'}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Btn>
            <Btn type="submit" form="optica-form" loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear óptica'}
            </Btn>
          </>
        }
      >
        <form id="optica-form" onSubmit={guardar} className="space-y-4">
          {generalError && (
            <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{generalError}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" required error={errors.nombre} className="sm:col-span-2">
              <Input value={form.nombre} onChange={f('nombre')} required autoFocus />
            </Field>
            <Field label="Dirección" required error={errors.direccion}>
              <Input
                value={form.direccion}
                onChange={f('direccion')}
                required
                placeholder="Av. Santa Fe 1234"
              />
            </Field>
            <Field label="Localidad" required error={errors.localidad}>
              <Input value={form.localidad} onChange={f('localidad')} required />
            </Field>
            <Field label="Provincia" required error={errors.provincia}>
              <Input value={form.provincia} onChange={f('provincia')} required list="provincias" />
              <datalist id="provincias">
                {provincias.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field label="Código postal" required error={errors.codigoPostal} hint="1425 o C1425ABC">
              <Input value={form.codigoPostal} onChange={f('codigoPostal')} required maxLength={8} />
            </Field>
            <Field label="Latitud" error={errors.lat} hint="Decimal, ej. -34.5875">
              <Input value={form.lat} onChange={f('lat')} inputMode="decimal" />
            </Field>
            <Field label="Longitud" error={errors.lng} hint="Decimal, ej. -58.4000">
              <Input value={form.lng} onChange={f('lng')} inputMode="decimal" />
            </Field>
            <Field label="WhatsApp" error={errors.whatsapp} hint="Con código de país: 5491112345678">
              <Input value={form.whatsapp} onChange={f('whatsapp')} inputMode="tel" />
            </Field>
            <Field label="Teléfono" error={errors.telefono}>
              <Input value={form.telefono} onChange={f('telefono')} inputMode="tel" />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={form.email} onChange={f('email')} />
            </Field>
            <Field label="Orden" error={errors.orden} hint="Menor aparece primero a igual distancia.">
              <Input type="number" min={0} value={form.orden} onChange={f('orden')} />
            </Field>
            <Field label="Horarios" error={errors.horarios} className="sm:col-span-2">
              <Textarea
                value={form.horarios}
                onChange={f('horarios')}
                placeholder="Lun a vie 10 a 19 h · Sáb 10 a 13 h"
                className="min-h-[64px]"
              />
            </Field>
          </div>
          <Checkbox
            label="Óptica activa (visible en la tienda)"
            checked={form.activa}
            onChange={(e) => setForm({ ...form, activa: e.target.checked })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={eliminar}
        title="Eliminar óptica"
        description={toDelete ? `Se eliminará "${toDelete.nombre}" de la red.` : undefined}
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  );
}
