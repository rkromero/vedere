'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Btn,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
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
import { ApiError, api, errorMessage } from '@/lib/api-client';
import { LABELS, formatFecha, options } from '@/lib/format';
import type { Rol } from '@/lib/format';
import type { Paged, Usuario } from '@/lib/types';

const ROL_TONE: Record<Rol, 'info' | 'ok' | 'neutral'> = {
  ADMIN: 'info',
  OPERADOR: 'ok',
  OPTICA: 'neutral',
  CLIENTE: 'neutral',
};

function generarPassword(len = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

interface FormState {
  email: string;
  nombre: string;
  telefono: string;
  rol: Rol;
  opticaId: string;
  activo: boolean;
  password: string;
}

const emptyForm: FormState = {
  email: '',
  nombre: '',
  telefono: '',
  rol: 'CLIENTE',
  opticaId: '',
  activo: true,
  password: '',
};

function useFormErrors() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const reset = () => {
    setFieldErrors({});
    setGeneral(null);
  };
  const capture = (err: unknown) => {
    if (err instanceof ApiError) {
      setFieldErrors(err.fieldErrors);
      setGeneral(err.message);
    } else setGeneral(errorMessage(err));
  };
  return { fieldErrors, general, reset, capture };
}

export function UsuariosTable({
  data,
  currentUserId,
  opticas,
}: {
  data: Paged<Usuario>;
  currentUserId: string;
  /** Ópticas socias para vincular usuarios con rol OPTICA. */
  opticas: Array<{ id: string; nombre: string; activa: boolean }>;
}) {
  const router = useRouter();
  const toast = useToast();

  const [modal, setModal] = useState<
    { mode: 'crear' } | { mode: 'editar'; usuario: Usuario } | null
  >(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = useFormErrors();

  const [resetTarget, setResetTarget] = useState<Usuario | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const resetErrors = useFormErrors();

  const [toggleTarget, setToggleTarget] = useState<Usuario | null>(null);
  const [toggling, setToggling] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function openCrear() {
    errors.reset();
    setForm(emptyForm);
    setShowPassword(false);
    setModal({ mode: 'crear' });
  }

  function openEditar(u: Usuario) {
    errors.reset();
    setForm({
      email: u.email,
      nombre: u.nombre,
      telefono: u.telefono ?? '',
      rol: u.rol,
      opticaId: u.opticaId ?? '',
      activo: u.activo,
      password: '',
    });
    setModal({ mode: 'editar', usuario: u });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!modal) return;
    errors.reset();
    setSaving(true);
    try {
      const telefono = form.telefono.trim() || null;
      const opticaId = form.rol === 'OPTICA' ? form.opticaId || null : null;
      if (modal.mode === 'crear') {
        await api.post('/admin/usuarios', {
          email: form.email,
          nombre: form.nombre,
          telefono,
          rol: form.rol,
          opticaId,
          activo: form.activo,
          password: form.password,
        });
        toast.ok('Usuario creado');
      } else {
        await api.put(`/admin/usuarios/${modal.usuario.id}`, {
          nombre: form.nombre,
          telefono,
          rol: form.rol,
          opticaId,
          activo: form.activo,
        });
        toast.ok('Usuario actualizado');
      }
      setModal(null);
      router.refresh();
    } catch (err) {
      errors.capture(err);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    resetErrors.reset();
    setSaving(true);
    try {
      await api.post(`/admin/usuarios/${resetTarget.id}/password`, { password: resetPassword });
      toast.ok(`Contraseña de ${resetTarget.nombre} actualizada`);
      setResetTarget(null);
      setResetPassword('');
    } catch (err) {
      resetErrors.capture(err);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onToggle() {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const accion = toggleTarget.activo ? 'desactivar' : 'activar';
      await api.post(`/admin/usuarios/${toggleTarget.id}/${accion}`);
      toast.ok(toggleTarget.activo ? 'Usuario desactivado' : 'Usuario activado');
      setToggleTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setToggling(false);
    }
  }

  const esPropio = (u: Usuario) => u.id === currentUserId;

  return (
    <>
      <Toolbar>
        <SearchInput placeholder="Buscar por nombre o email…" />
        <FilterSelect param="rol" label="Rol" options={options(LABELS.rol)} />
        <FilterSelect
          param="activo"
          label="Estado"
          options={[
            { value: 'true', label: 'Activos' },
            { value: 'false', label: 'Inactivos' },
          ]}
        />
        <div className="ml-auto">
          <Btn onClick={openCrear}>Nuevo usuario</Btn>
        </div>
      </Toolbar>

      {data.items.length === 0 ? (
        <EmptyState
          title="No hay usuarios con esos filtros"
          description="Probá con otra búsqueda o creá un usuario nuevo."
          action={<Btn onClick={openCrear}>Nuevo usuario</Btn>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Email</Th>
              <Th>Teléfono</Th>
              <Th>Rol</Th>
              <Th>Estado</Th>
              <Th>Alta</Th>
              <Th align="right">Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((u) => (
              <Tr key={u.id}>
                <Td className="font-medium">
                  {u.nombre}
                  {esPropio(u) && <span className="ml-2 text-xs text-gris-medio">(vos)</span>}
                </Td>
                <Td className="text-negro/80">{u.email}</Td>
                <Td className="text-negro/80">{u.telefono ?? '—'}</Td>
                <Td>
                  <Badge tone={ROL_TONE[u.rol]}>{LABELS.rol[u.rol]}</Badge>
                  {u.rol === 'OPTICA' && (
                    <span className="mt-1 block text-xs text-gris-medio">
                      {u.optica?.nombre ?? 'Sin óptica vinculada'}
                    </span>
                  )}
                </Td>
                <Td>
                  <Badge tone={u.activo ? 'ok' : 'danger'}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </Td>
                <Td className="text-negro/80">{formatFecha(u.createdAt)}</Td>
                <Td align="right">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Btn size="sm" variant="ghost" onClick={() => openEditar(u)}>
                      Editar
                    </Btn>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        resetErrors.reset();
                        setResetPassword('');
                        setResetTarget(u);
                      }}
                    >
                      Contraseña
                    </Btn>
                    <Btn
                      size="sm"
                      variant={u.activo ? 'danger' : 'secondary'}
                      disabled={esPropio(u)}
                      title={esPropio(u) ? 'No podés desactivar tu propio usuario' : undefined}
                      onClick={() => setToggleTarget(u)}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </Btn>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        pageSize={data.pageSize}
      />

      {/* Crear / editar */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'editar' ? `Editar ${modal.usuario.nombre}` : 'Nuevo usuario'}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Btn>
            <Btn type="submit" form="usuario-form" loading={saving}>
              {modal?.mode === 'editar' ? 'Guardar cambios' : 'Crear usuario'}
            </Btn>
          </>
        }
      >
        <form id="usuario-form" onSubmit={onSubmit} className="space-y-4">
          {errors.general && (
            <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{errors.general}</p>
          )}
          <Field label="Email" required error={errors.fieldErrors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              disabled={modal?.mode === 'editar'}
              required
              autoFocus={modal?.mode === 'crear'}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" required error={errors.fieldErrors.nombre}>
              <Input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required />
            </Field>
            <Field label="Teléfono" error={errors.fieldErrors.telefono}>
              <Input
                value={form.telefono}
                onChange={(e) => set('telefono', e.target.value)}
                placeholder="+54 11 ..."
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Rol"
              error={errors.fieldErrors.rol}
              hint={
                modal?.mode === 'editar' && esPropio(modal.usuario)
                  ? 'No podés cambiar tu propio rol'
                  : undefined
              }
            >
              <Select
                value={form.rol}
                onChange={(e) => set('rol', e.target.value as Rol)}
                disabled={modal?.mode === 'editar' && esPropio(modal.usuario)}
              >
                {options(LABELS.rol).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox
                label="Usuario activo"
                checked={form.activo}
                onChange={(e) => set('activo', e.target.checked)}
                disabled={modal?.mode === 'editar' && esPropio(modal.usuario)}
              />
            </div>
          </div>
          {form.rol === 'OPTICA' && (
            <Field
              label="Óptica socia"
              required
              error={errors.fieldErrors.opticaId}
              hint="El usuario sólo ve y opera los pedidos de esta óptica en /optica."
            >
              <Select value={form.opticaId} onChange={(e) => set('opticaId', e.target.value)} required>
                <option value="">Elegí la óptica…</option>
                {opticas.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                    {o.activa ? '' : ' (pausada)'}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {modal?.mode === 'crear' && (
            <Field
              label="Contraseña"
              required
              error={errors.fieldErrors.password}
              hint="Mínimo 8 caracteres."
            >
              <div className="flex gap-2">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
                <Btn variant="secondary" onClick={() => setShowPassword((s) => !s)}>
                  {showPassword ? 'Ocultar' : 'Ver'}
                </Btn>
                <Btn
                  variant="secondary"
                  onClick={() => {
                    set('password', generarPassword());
                    setShowPassword(true);
                  }}
                >
                  Generar
                </Btn>
              </div>
            </Field>
          )}
        </form>
      </Modal>

      {/* Reset de contraseña */}
      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={`Resetear contraseña de ${resetTarget?.nombre ?? ''}`}
        size="sm"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setResetTarget(null)}>
              Cancelar
            </Btn>
            <Btn type="submit" form="reset-form" loading={saving}>
              Guardar contraseña
            </Btn>
          </>
        }
      >
        <form id="reset-form" onSubmit={onReset} className="space-y-4">
          <p className="text-sm text-negro/80">
            La nueva contraseña reemplaza a la actual y cierra todas las sesiones abiertas de este
            usuario.
          </p>
          {resetErrors.general && (
            <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">
              {resetErrors.general}
            </p>
          )}
          <Field
            label="Nueva contraseña"
            required
            error={resetErrors.fieldErrors.password}
            hint="Mínimo 8 caracteres."
          >
            <div className="flex gap-2">
              <Input
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
                autoFocus
              />
              <Btn variant="secondary" onClick={() => setResetPassword(generarPassword())}>
                Generar
              </Btn>
            </div>
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={onToggle}
        loading={toggling}
        danger={!!toggleTarget?.activo}
        title={toggleTarget?.activo ? 'Desactivar usuario' : 'Activar usuario'}
        confirmLabel={toggleTarget?.activo ? 'Desactivar' : 'Activar'}
        description={
          toggleTarget?.activo
            ? `${toggleTarget.nombre} no va a poder ingresar y se cierran sus sesiones abiertas. Podés reactivarlo después.`
            : `${toggleTarget?.nombre ?? ''} va a poder volver a ingresar.`
        }
      />
    </>
  );
}
