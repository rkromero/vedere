'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@vedere/ui';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { formatFecha, toDateInput } from '@/lib/format';
import type { Coleccion, Paged } from '@/lib/types';
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

const PRESETS = [
  { nombre: 'Sol', hex: '#F2B33D' },
  { nombre: 'Vetro', hex: '#7FD1C1' },
  { nombre: 'Noche', hex: '#3A5BD9' },
  { nombre: 'Carey', hex: '#B7712F' },
];

interface FormState {
  nombre: string;
  slug: string;
  colorHex: string;
  bannerUrl: string | null;
  vigenciaDesde: string;
  vigenciaHasta: string;
  activa: boolean;
}

const vacio: FormState = {
  nombre: '',
  slug: '',
  colorHex: '#0A0A0A',
  bannerUrl: null,
  vigenciaDesde: '',
  vigenciaHasta: '',
  activa: true,
};

function vigencia(c: Coleccion): string {
  if (!c.vigenciaDesde && !c.vigenciaHasta) return 'Sin límite';
  const desde = c.vigenciaDesde ? formatFecha(c.vigenciaDesde) : '…';
  const hasta = c.vigenciaHasta ? formatFecha(c.vigenciaHasta) : '…';
  return `${desde} – ${hasta}`;
}

function vigente(c: Coleccion): boolean {
  const now = Date.now();
  if (c.vigenciaDesde && new Date(c.vigenciaDesde).getTime() > now) return false;
  if (c.vigenciaHasta && new Date(c.vigenciaHasta).getTime() < now) return false;
  return true;
}

/** "YYYY-MM-DD" → ISO (inicio o fin del día en UTC) o null. */
function dateToIso(value: string, finDeDia: boolean): string | null {
  if (!value) return null;
  return new Date(`${value}T${finDeDia ? '23:59:59.999' : '00:00:00.000'}Z`).toISOString();
}

export function ColeccionesTable({ data }: { data: Paged<Coleccion> }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coleccion | null>(null);
  const [form, setForm] = useState<FormState>(vacio);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Coleccion | null>(null);
  const [deleting, setDeleting] = useState(false);

  function abrir(c: Coleccion | null) {
    setEditing(c);
    setForm(
      c
        ? {
            nombre: c.nombre,
            slug: c.slug,
            colorHex: c.colorHex,
            bannerUrl: c.bannerUrl,
            vigenciaDesde: toDateInput(c.vigenciaDesde),
            vigenciaHasta: toDateInput(c.vigenciaHasta),
            activa: c.activa,
          }
        : vacio,
    );
    setErrors({});
    setGeneralError(null);
    setOpen(true);
  }

  const hexValido = /^#[0-9a-fA-F]{6}$/.test(form.colorHex);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setGeneralError(null);
    const payload = {
      nombre: form.nombre.trim(),
      ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
      colorHex: form.colorHex.trim().toUpperCase(),
      bannerUrl: form.bannerUrl || null,
      vigenciaDesde: dateToIso(form.vigenciaDesde, false),
      vigenciaHasta: dateToIso(form.vigenciaHasta, true),
      activa: form.activa,
    };
    try {
      if (editing) {
        await api.put(`/admin/colecciones/${editing.id}`, payload);
        toast.ok('Colección actualizada');
      } else {
        await api.post('/admin/colecciones', payload);
        toast.ok('Colección creada');
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
      await api.del(`/admin/colecciones/${toDelete.id}`);
      toast.ok('Colección eliminada');
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
        title="Colecciones"
        description="Colecciones de campaña con color, banner y vigencia: Sol, Vetro, Noche y Carey."
        actions={<Btn onClick={() => abrir(null)}>Nueva colección</Btn>}
      />

      <Toolbar>
        <SearchInput placeholder="Buscar colección…" />
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
          title="No hay colecciones"
          description="Creá una colección para agrupar productos por campaña."
          action={<Btn onClick={() => abrir(null)}>Nueva colección</Btn>}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Colección</Th>
                <Th>Slug</Th>
                <Th>Vigencia</Th>
                <Th align="right">Productos</Th>
                <Th>Estado</Th>
                <Th>Banner</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block h-6 w-6 shrink-0 rounded-full border border-negro/10"
                        style={{ backgroundColor: c.colorHex }}
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-medium">{c.nombre}</p>
                        <p className="text-xs text-gris-medio">{c.colorHex}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-gris-medio">{c.slug}</Td>
                  <Td>
                    <span className={cn(!vigente(c) && 'text-gris-medio')}>{vigencia(c)}</span>
                    {!vigente(c) && (
                      <Badge tone="warn" className="ml-2">
                        Fuera de vigencia
                      </Badge>
                    )}
                  </Td>
                  <Td align="right">{c.productos ?? 0}</Td>
                  <Td>
                    <Badge tone={c.activa ? 'ok' : 'neutral'}>
                      {c.activa ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </Td>
                  <Td>
                    {c.bannerUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.bannerUrl}
                        alt=""
                        className="h-10 w-20 rounded-md border border-negro/10 object-cover"
                      />
                    ) : (
                      <span className="text-xs text-gris-medio">—</span>
                    )}
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
        title={editing ? 'Editar colección' : 'Nueva colección'}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Btn>
            <Btn type="submit" form="coleccion-form" loading={saving} disabled={!hexValido}>
              {editing ? 'Guardar cambios' : 'Crear colección'}
            </Btn>
          </>
        }
      >
        <form id="coleccion-form" onSubmit={guardar} className="space-y-4">
          {generalError && (
            <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{generalError}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" required error={errors.nombre}>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                autoFocus
              />
            </Field>
            <Field label="Slug" hint="Se genera del nombre si queda vacío." error={errors.slug}>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="vetro"
              />
            </Field>
          </div>

          <Field
            label="Color"
            required
            error={errors.colorHex ?? (!hexValido ? 'Formato #RRGGBB' : undefined)}
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hexValido ? form.colorHex : '#000000'}
                onChange={(e) => setForm({ ...form, colorHex: e.target.value.toUpperCase() })}
                className="h-10 w-12 cursor-pointer rounded-lg border border-negro/20 bg-blanco p-1"
                aria-label="Selector de color"
              />
              <Input
                value={form.colorHex}
                onChange={(e) => setForm({ ...form, colorHex: e.target.value })}
                placeholder="#F2B33D"
                maxLength={7}
                className="font-mono uppercase"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => setForm({ ...form, colorHex: p.hex })}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-gris-claro',
                    form.colorHex.toUpperCase() === p.hex ? 'border-negro' : 'border-negro/15',
                  )}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.hex }} />
                  {p.nombre}
                </button>
              ))}
            </div>
          </Field>

          <ImagenField
            label="Banner"
            value={form.bannerUrl}
            onChange={(bannerUrl) => setForm({ ...form, bannerUrl })}
            folder="colecciones"
            tamano="url"
            error={errors.bannerUrl}
            hint="Imagen horizontal para la portada de la colección."
            previewClassName="h-16 w-16 rounded-lg object-cover"
          />

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
            label="Colección activa"
            checked={form.activa}
            onChange={(e) => setForm({ ...form, activa: e.target.checked })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={eliminar}
        title="Eliminar colección"
        description={
          toDelete
            ? `Se eliminará "${toDelete.nombre}". Los productos asociados quedan sin colección.`
            : undefined
        }
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  );
}
