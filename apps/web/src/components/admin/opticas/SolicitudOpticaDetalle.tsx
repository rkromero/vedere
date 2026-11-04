'use client';
// Detalle de una solicitud de alta: datos, habilitación, coincidencias por CUIT y acciones aprobar / rechazar.
// Al aprobar se muestra una sola vez la contraseña provisoria (por si el email no llega).
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api-client';
import { formatFecha } from '@/lib/format';
import type { SolicitudOpticaDetalle as Detalle } from '@/lib/types';
import { Badge, Btn, Card, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';
import { CONDICION_IVA, ESTADO_SOLICITUD, TONO_SOLICITUD } from './solicitud-labels';

interface Aprobacion {
  optica: { id: string; nombre: string; slug: string; creada: boolean };
  usuario: { id: string; email: string; nombre: string; creado: boolean };
  passwordProvisoria: string;
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gris-medio">{label}</dt>
      <dd className="mt-0.5 text-sm">{children || '—'}</dd>
    </div>
  );
}

export function SolicitudOpticaDetalle({ solicitud: s }: { solicitud: Detalle }) {
  const router = useRouter();
  const toast = useToast();
  const [aprobarAbierto, setAprobarAbierto] = useState(false);
  const [rechazarAbierto, setRechazarAbierto] = useState(false);
  const [opticaId, setOpticaId] = useState(s.coincidencias[0]?.id ?? '');
  const [comisionPct, setComisionPct] = useState('10');
  const [radioKm, setRadioKm] = useState('10');
  const [capacidad, setCapacidad] = useState('20');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<Aprobacion | null>(null);

  const pendiente = s.estado === 'PENDIENTE';
  const usuarioBloquea = s.usuarioExistente && s.usuarioExistente.rol !== 'OPTICA';
  const vincular = s.coincidencias.length > 0 && opticaId !== '';

  async function aprobar() {
    setError(null);
    setCargando(true);
    try {
      const r = await api.post<Aprobacion>(`/admin/opticas/solicitudes/${s.id}/aprobar`, {
        opticaId: opticaId || null,
        ...(vincular
          ? {}
          : { comisionPct: Number(comisionPct), radioKm: Number(radioKm), capacidadDiaria: Number(capacidad) }),
      });
      setAprobarAbierto(false);
      setResultado(r);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCargando(false);
    }
  }

  async function rechazar() {
    setError(null);
    if (motivo.trim().length < 5) {
      setError('Contale a la óptica por qué (mínimo 5 caracteres): le llega por email.');
      return;
    }
    setCargando(true);
    try {
      await api.post(`/admin/opticas/solicitudes/${s.id}/rechazar`, { motivo: motivo.trim() });
      setRechazarAbierto(false);
      toast.ok('Solicitud rechazada: le avisamos por email');
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <PageHeader
        title={s.nombreComercial}
        description={`Solicitud recibida el ${formatFecha(s.createdAt, true)}`}
        actions={
          pendiente ? (
            <>
              <Btn variant="secondary" onClick={() => setRechazarAbierto(true)} data-testid="solicitud-rechazar">
                Rechazar
              </Btn>
              <Btn onClick={() => setAprobarAbierto(true)} disabled={!!usuarioBloquea} data-testid="solicitud-aprobar">
                Aprobar
              </Btn>
            </>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={TONO_SOLICITUD[s.estado]}>{ESTADO_SOLICITUD[s.estado]}</Badge>
        {s.resueltoEn && <span className="text-sm text-gris-medio">el {formatFecha(s.resueltoEn, true)}</span>}
        {s.optica && (
          <Link href={`/admin/opticas?q=${encodeURIComponent(s.optica.nombre)}`} className="text-sm underline underline-offset-2">
            Ver óptica {s.optica.nombre}
          </Link>
        )}
      </div>

      {s.estado === 'RECHAZADA' && s.motivoRechazo && (
        <p className="mb-4 rounded-lg bg-carey/10 px-4 py-3 text-sm text-carey">Motivo del rechazo: {s.motivoRechazo}</p>
      )}
      {pendiente && usuarioBloquea && (
        <p className="mb-4 rounded-lg bg-carey/10 px-4 py-3 text-sm text-carey" role="alert">
          Ya existe una cuenta {s.usuarioExistente!.rol === 'CLIENTE' ? 'de cliente' : 'del equipo'} con el email {s.email}. Para
          aprobarla, pedile a la óptica otro email o cambiá el de esa cuenta en Usuarios.
        </p>
      )}
      {pendiente && s.coincidencias.length > 0 && (
        <p className="mb-4 rounded-lg bg-sol/30 px-4 py-3 text-sm">
          Ya hay {s.coincidencias.length === 1 ? 'una óptica' : 'ópticas'} con este CUIT (
          {s.coincidencias.map((o) => `${o.nombre}, ${o.localidad}`).join(' · ')}). Al aprobar podés vincular la solicitud a
          esa óptica en vez de crear otra.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Datos fiscales">
          <dl className="grid grid-cols-2 gap-4">
            <Dato label="Razón social">{s.razonSocial}</Dato>
            <Dato label="Nombre comercial">{s.nombreComercial}</Dato>
            <Dato label="CUIT">
              <span className="font-mono">{s.cuit}</span>
            </Dato>
            <Dato label="Condición frente al IVA">{CONDICION_IVA[s.condicionIva]}</Dato>
          </dl>
        </Card>
        <Card title="Local y contacto">
          <dl className="grid grid-cols-2 gap-4">
            <Dato label="Dirección">
              {s.direccion}
              <br />
              {s.localidad}, {s.provincia} ({s.codigoPostal})
            </Dato>
            <Dato label="Email">
              <a href={`mailto:${s.email}`} className="underline underline-offset-2">
                {s.email}
              </a>
            </Dato>
            <Dato label="Teléfono">{s.telefono}</Dato>
            <Dato label="WhatsApp">{s.whatsapp}</Dato>
          </dl>
        </Card>
        <Card title="Responsable técnico">
          <dl className="grid grid-cols-2 gap-4">
            <Dato label="Óptico responsable">{s.opticoResponsable}</Dato>
            <Dato label="Matrícula">{s.matricula}</Dato>
          </dl>
        </Card>
        <Card title="Habilitación y términos">
          <dl className="grid grid-cols-2 gap-4">
            <Dato label="Habilitación">
              <a href={s.habilitacionUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {s.habilitacionNombre || 'Ver archivo'}
              </a>
            </Dato>
            <Dato label="Aceptó los términos">{formatFecha(s.aceptaTerminosEn, true)}</Dato>
          </dl>
        </Card>
      </div>

      <Modal
        open={aprobarAbierto}
        onClose={() => setAprobarAbierto(false)}
        title="Aprobar solicitud"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setAprobarAbierto(false)}>
              Cancelar
            </Btn>
            <Btn onClick={aprobar} loading={cargando} data-testid="solicitud-aprobar-confirmar">
              Aprobar y mandar el acceso
            </Btn>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          {s.coincidencias.length > 0 && (
            <Field label="Óptica">
              <Select value={opticaId} onChange={(e) => setOpticaId(e.target.value)}>
                {s.coincidencias.map((o) => (
                  <option key={o.id} value={o.id}>
                    Vincular a {o.nombre} ({o.localidad})
                  </option>
                ))}
                <option value="">Crear una óptica nueva</option>
              </Select>
            </Field>
          )}
          {!vincular && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Comisión (%)" hint="Por pedido web entregado.">
                <Input type="number" min={0} max={100} step="0.5" value={comisionPct} onChange={(e) => setComisionPct(e.target.value)} />
              </Field>
              <Field label="Radio (km)">
                <Input type="number" min={0.5} step="0.5" value={radioKm} onChange={(e) => setRadioKm(e.target.value)} />
              </Field>
              <Field label="Pedidos por día">
                <Input type="number" min={0} value={capacidad} onChange={(e) => setCapacidad(e.target.value)} />
              </Field>
            </div>
          )}
          <p className="text-gris-medio">
            {vincular ? 'Se actualizan los datos fiscales de la óptica y' : 'Se crea la óptica (activa) y'} un usuario dueño con
            el email <strong className="text-negro">{s.email}</strong> y una contraseña provisoria que tiene que cambiar en el
            primer ingreso. Le mandamos el acceso por email.
          </p>
          {error && (
            <p className="rounded-lg bg-carey/10 px-3 py-2 text-carey" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={rechazarAbierto}
        onClose={() => setRechazarAbierto(false)}
        title="Rechazar solicitud"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setRechazarAbierto(false)}>
              Cancelar
            </Btn>
            <Btn variant="danger" onClick={rechazar} loading={cargando} data-testid="solicitud-rechazar-confirmar">
              Rechazar y avisar
            </Btn>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <Field label="Motivo" hint="Le llega a la óptica por email.">
            <Textarea
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por ejemplo: la habilitación está vencida."
            />
          </Field>
          {error && (
            <p className="rounded-lg bg-carey/10 px-3 py-2 text-carey" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={resultado !== null}
        onClose={() => setResultado(null)}
        title="Solicitud aprobada"
        footer={<Btn onClick={() => setResultado(null)}>Listo</Btn>}
      >
        {resultado && (
          <div className="space-y-3 text-sm" data-testid="aprobacion-resultado">
            <p>
              {resultado.optica.creada ? 'Creamos' : 'Vinculamos'} la óptica <strong>{resultado.optica.nombre}</strong> y{' '}
              {resultado.usuario.creado ? 'el usuario' : 'actualizamos el usuario'} <strong>{resultado.usuario.email}</strong>.
              Le mandamos el acceso por email.
            </p>
            <div className="rounded-lg bg-gris-claro px-4 py-3">
              <p className="text-xs text-gris-medio">Contraseña provisoria (se muestra sólo esta vez)</p>
              <p className="mt-1 select-all font-mono text-lg" data-testid="password-provisoria">
                {resultado.passwordProvisoria}
              </p>
            </div>
            <p className="text-gris-medio">
              Si el email no llega, pasásela por otro medio. Revisá en el ABM de ópticas las coordenadas para la asignación
              automática de pedidos.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
