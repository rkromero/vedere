'use client';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@vedere/ui';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import type { Categoria } from '@/lib/types';
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
import { Table, Td, Th, Toolbar, Tr } from '@/components/admin/table';
import { useToast } from '@/components/admin/toast';

interface FlatNode {
  cat: Categoria;
  nivel: number;
  tieneHijas: boolean;
}

/** Aplana el árbol en orden de recorrido, con nivel de profundidad. */
function flatten(nodes: Categoria[], nivel = 0, out: FlatNode[] = []): FlatNode[] {
  for (const c of nodes) {
    const hijas = c.hijas ?? [];
    out.push({ cat: c, nivel, tieneHijas: hijas.length > 0 });
    flatten(hijas, nivel + 1, out);
  }
  return out;
}

/** Ids de un nodo y todos sus descendientes. */
function descendientes(c: Categoria): string[] {
  return [c.id, ...(c.hijas ?? []).flatMap(descendientes)];
}

interface FormState {
  nombre: string;
  slug: string;
  padreId: string;
  orden: number;
  activa: boolean;
}

const vacio: FormState = { nombre: '', slug: '', padreId: '', orden: 0, activa: true };

export function CategoriasTree({ tree }: { tree: Categoria[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [form, setForm] = useState<FormState>(vacio);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Categoria | null>(null);
  const [deleting, setDeleting] = useState(false);

  const flat = useMemo(() => flatten(tree), [tree]);

  // Filas visibles: respeta colapsado (salvo que haya búsqueda) y filtra por nombre/slug.
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (q) {
      return flat.filter((n) => n.cat.nombre.toLowerCase().includes(q) || n.cat.slug.includes(q));
    }
    const ocultos = new Set<string>();
    for (const n of flat) {
      if (colapsadas.has(n.cat.id)) {
        for (const id of descendientes(n.cat)) if (id !== n.cat.id) ocultos.add(id);
      }
    }
    return flat.filter((n) => !ocultos.has(n.cat.id));
  }, [flat, busqueda, colapsadas]);

  function toggle(id: string) {
    setColapsadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function abrir(cat: Categoria | null, padreId = '') {
    setEditing(cat);
    setForm(
      cat
        ? {
            nombre: cat.nombre,
            slug: cat.slug,
            padreId: cat.padreId ?? '',
            orden: cat.orden,
            activa: cat.activa,
          }
        : { ...vacio, padreId },
    );
    setErrors({});
    setGeneralError(null);
    setOpen(true);
  }

  // Opciones de padre: todas menos la propia y sus descendientes (al editar).
  const excluidas = useMemo(() => new Set(editing ? descendientes(editing) : []), [editing]);
  const opcionesPadre = flat.filter((n) => !excluidas.has(n.cat.id));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setGeneralError(null);
    const payload = {
      nombre: form.nombre.trim(),
      ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
      padreId: form.padreId || null,
      orden: Number(form.orden) || 0,
      activa: form.activa,
    };
    try {
      if (editing) {
        await api.put(`/admin/categorias/${editing.id}`, payload);
        toast.ok('Categoría actualizada');
      } else {
        await api.post('/admin/categorias', payload);
        toast.ok('Categoría creada');
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
      await api.del(`/admin/categorias/${toDelete.id}`);
      toast.ok('Categoría eliminada');
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
        title="Categorías"
        description="Árbol de categorías de la tienda. Base: Sol, Recetados, Multifocal y Accesorios."
        actions={<Btn onClick={() => abrir(null)}>Nueva categoría</Btn>}
      />

      <Toolbar>
        <div className="relative w-full sm:w-72">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar categoría…"
            className="h-10 w-full rounded-lg border border-negro/20 bg-blanco px-3 text-sm placeholder:text-gris-medio focus:border-negro focus:outline-none focus:ring-1 focus:ring-negro"
          />
        </div>
        {colapsadas.size > 0 && (
          <Btn variant="ghost" size="sm" onClick={() => setColapsadas(new Set())}>
            Expandir todo
          </Btn>
        )}
      </Toolbar>

      {flat.length === 0 ? (
        <EmptyState
          title="No hay categorías"
          description="Creá las categorías base y luego subcategorías dentro de cada una."
          action={<Btn onClick={() => abrir(null)}>Nueva categoría</Btn>}
        />
      ) : visibles.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="Ninguna categoría coincide con la búsqueda."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Slug</Th>
              <Th align="right">Orden</Th>
              <Th align="right">Productos</Th>
              <Th>Estado</Th>
              <Th align="right">Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(({ cat, nivel, tieneHijas }) => (
              <Tr key={cat.id}>
                <Td>
                  <div
                    className="flex items-center gap-1"
                    style={{ paddingLeft: `${nivel * 1.25}rem` }}
                  >
                    {tieneHijas && !busqueda ? (
                      <button
                        type="button"
                        onClick={() => toggle(cat.id)}
                        aria-label={colapsadas.has(cat.id) ? 'Expandir' : 'Colapsar'}
                        className="rounded p-0.5 text-gris-medio hover:bg-gris-claro hover:text-negro"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={cn(
                            'transition-transform',
                            colapsadas.has(cat.id) ? '-rotate-90' : '',
                          )}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    ) : (
                      <span className="inline-block w-5" />
                    )}
                    <span className={cn('font-medium', nivel === 0 && 'text-base')}>
                      {cat.nombre}
                    </span>
                  </div>
                </Td>
                <Td className="text-gris-medio">{cat.slug}</Td>
                <Td align="right">{cat.orden}</Td>
                <Td align="right">{cat.productos ?? 0}</Td>
                <Td>
                  <Badge tone={cat.activa ? 'ok' : 'neutral'}>
                    {cat.activa ? 'Activa' : 'Inactiva'}
                  </Badge>
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <Btn variant="ghost" size="sm" onClick={() => abrir(cat)}>
                      Editar
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={() => abrir(null, cat.id)}>
                      + Hija
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={() => setToDelete(cat)}>
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
        title={editing ? 'Editar categoría' : 'Nueva categoría'}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Btn>
            <Btn type="submit" form="categoria-form" loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear categoría'}
            </Btn>
          </>
        }
      >
        <form id="categoria-form" onSubmit={guardar} className="space-y-4">
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
              placeholder="polarizados"
            />
          </Field>
          <Field label="Categoría padre" error={errors.padreId}>
            <Select
              value={form.padreId}
              onChange={(e) => setForm({ ...form, padreId: e.target.value })}
            >
              <option value="">— Sin padre (categoría base) —</option>
              {opcionesPadre.map(({ cat, nivel }) => (
                <option key={cat.id} value={cat.id}>
                  {'  '.repeat(nivel)}
                  {nivel > 0 ? '└ ' : ''}
                  {cat.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Orden" hint="Menor número, primero." error={errors.orden}>
              <Input
                type="number"
                min={0}
                value={form.orden}
                onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
              />
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox
                label="Categoría activa"
                checked={form.activa}
                onChange={(e) => setForm({ ...form, activa: e.target.checked })}
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={eliminar}
        title="Eliminar categoría"
        description={
          toDelete
            ? `Se eliminará "${toDelete.nombre}". Los productos no se borran, sólo pierden esta categoría. Si tiene subcategorías, movelas o eliminalas primero.`
            : undefined
        }
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  );
}
