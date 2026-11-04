'use client';
// Usuarios del panel de la óptica: el dueño da de alta a su equipo (con contraseña provisoria que llega por
// email y se muestra una vez), los desactiva o les genera una contraseña nueva. El resto sólo ve la lista.
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, api, errorMessage } from '@/lib/api-client';
import { formatFecha } from '@/lib/format';
import { Badge, Btn, ConfirmDialog, Field, Input, Modal, PageHeader } from '@/components/admin/ui';
import { Table, Td, Th, Tr } from '@/components/admin/table';
import { useToast } from '@/components/admin/toast';

export interface UsuarioOptica {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  activo: boolean;
  opticaDueno: boolean;
  debeCambiarPassword: boolean;
  createdAt: string;
}

type Accion = { tipo: 'desactivar' | 'activar' | 'password'; usuario: UsuarioOptica };

export function UsuariosOptica({
  usuarios,
  puedeAdministrar,
  yoId,
}: {
  usuarios: UsuarioOptica[];
  puedeAdministrar: boolean;
  yoId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [credencial, setCredencial] = useState<{ email: string; password: string } | null>(null);

  async function alta(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setErrores({});
    setGeneral(null);
    try {
      const r = await api.post<{ usuario: UsuarioOptica; passwordProvisoria: string }>('/optica/usuarios', {
        nombre: form.nombre,
        email: form.email,
        telefono: form.telefono || null,
      });
      setAltaAbierta(false);
      setForm({ nombre: '', email: '', telefono: '' });
      setCredencial({ email: r.usuario.email, password: r.passwordProvisoria });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrores(err.fieldErrors);
      setGeneral(errorMessage(err));
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutar() {
    if (!accion) return;
    const { tipo, usuario } = accion;
    try {
      const r = await api.post<{ passwordProvisoria?: string }>(`/optica/usuarios/${usuario.id}/${tipo}`);
      if (tipo === 'password' && r.passwordProvisoria) {
        setCredencial({ email: usuario.email, password: r.passwordProvisoria });
      } else {
        toast.ok(tipo === 'desactivar' ? `Desactivamos a ${usuario.nombre}` : `${usuario.nombre} puede volver a entrar`);
      }
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAccion(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Usuarios"
        description={
          puedeAdministrar
            ? 'Las personas de tu óptica que pueden entrar al panel. Cada una entra con su email y su contraseña.'
            : 'Las personas de tu óptica que pueden entrar al panel. Sólo el dueño puede dar de alta usuarios.'
        }
        actions={
          puedeAdministrar ? (
            <Btn onClick={() => setAltaAbierta(true)} data-testid="usuario-nuevo">
              Nuevo usuario
            </Btn>
          ) : undefined
        }
      />

      <Table>
        <thead>
          <tr>
            <Th>Nombre</Th>
            <Th>Email</Th>
            <Th>Rol</Th>
            <Th>Estado</Th>
            <Th>Alta</Th>
            {puedeAdministrar && <Th align="right">Acciones</Th>}
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => {
            const yo = u.id === yoId;
            return (
              <Tr key={u.id}>
                <Td>
                  <span className="font-medium">{u.nombre}</span>
                  {yo && <span className="ml-2 text-xs text-gris-medio">(vos)</span>}
                </Td>
                <Td>{u.email}</Td>
                <Td>{u.opticaDueno ? <Badge tone="info">Dueño</Badge> : 'Equipo'}</Td>
                <Td>
                  {!u.activo ? (
                    <Badge tone="danger">Desactivado</Badge>
                  ) : u.debeCambiarPassword ? (
                    <Badge tone="warn">Sin primer ingreso</Badge>
                  ) : (
                    <Badge tone="ok">Activo</Badge>
                  )}
                </Td>
                <Td>{formatFecha(u.createdAt)}</Td>
                {puedeAdministrar && (
                  <Td align="right">
                    {yo ? (
                      <Link href="/optica/cambiar-password" className="text-xs underline underline-offset-2">
                        Cambiar mi contraseña
                      </Link>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Btn size="sm" variant="ghost" onClick={() => setAccion({ tipo: 'password', usuario: u })}>
                          Nueva contraseña
                        </Btn>
                        {u.activo ? (
                          <Btn size="sm" variant="danger" onClick={() => setAccion({ tipo: 'desactivar', usuario: u })}>
                            Desactivar
                          </Btn>
                        ) : (
                          <Btn size="sm" variant="secondary" onClick={() => setAccion({ tipo: 'activar', usuario: u })}>
                            Activar
                          </Btn>
                        )}
                      </div>
                    )}
                  </Td>
                )}
              </Tr>
            );
          })}
        </tbody>
      </Table>
      {!puedeAdministrar && (
        <p className="mt-4 text-sm text-gris-medio">
          <Link href="/optica/cambiar-password" className="underline underline-offset-2">
            Cambiar mi contraseña
          </Link>
        </p>
      )}

      <Modal
        open={altaAbierta}
        onClose={() => setAltaAbierta(false)}
        title="Nuevo usuario"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setAltaAbierta(false)}>
              Cancelar
            </Btn>
            <Btn type="submit" form="alta-usuario" loading={guardando} data-testid="usuario-crear">
              Dar de alta
            </Btn>
          </>
        }
      >
        <form id="alta-usuario" onSubmit={alta} className="space-y-4" noValidate>
          {general && (
            <p role="alert" className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">
              {general}
            </p>
          )}
          <Field label="Nombre y apellido" required error={errores.nombre}>
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus />
          </Field>
          <Field label="Email" required error={errores.email} hint="Ahí le llega la contraseña provisoria.">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Teléfono" error={errores.telefono}>
            <Input type="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={accion !== null}
        onClose={() => setAccion(null)}
        onConfirm={ejecutar}
        title={
          accion?.tipo === 'desactivar'
            ? `¿Desactivar a ${accion.usuario.nombre}?`
            : accion?.tipo === 'activar'
              ? `¿Reactivar a ${accion.usuario.nombre}?`
              : `¿Generar una contraseña nueva para ${accion?.usuario.nombre}?`
        }
        description={
          accion?.tipo === 'desactivar'
            ? 'No va a poder entrar al panel hasta que lo reactives. Se cierran sus sesiones abiertas.'
            : accion?.tipo === 'password'
              ? 'Le mandamos una contraseña provisoria por email y tiene que cambiarla al entrar.'
              : undefined
        }
        confirmLabel={accion?.tipo === 'desactivar' ? 'Desactivar' : 'Confirmar'}
        danger={accion?.tipo === 'desactivar'}
      />

      <Modal
        open={credencial !== null}
        onClose={() => setCredencial(null)}
        title="Acceso creado"
        footer={<Btn onClick={() => setCredencial(null)}>Listo</Btn>}
      >
        {credencial && (
          <div className="space-y-3 text-sm" data-testid="usuario-credencial">
            <p>
              Le mandamos el acceso a <strong>{credencial.email}</strong>. Si no le llega, pasale esta contraseña provisoria:
            </p>
            <p className="select-all rounded-lg bg-gris-claro px-4 py-3 font-mono text-lg">{credencial.password}</p>
            <p className="text-gris-medio">Se muestra sólo esta vez. La tiene que cambiar en el primer ingreso.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
