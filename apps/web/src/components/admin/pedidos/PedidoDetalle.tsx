'use client';
// Detalle de un pedido en el backoffice: estado y acciones (cambiar estado, reasignar con candidatas,
// reenviar emails, reembolsar, cancelar, aprobar/rechazar transferencia), línea de tiempo, notas
// internas, pago, solicitudes de cambio/devolución, reembolsos y emails enviados.
import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { formatFecha, formatPrecio } from '@/lib/format';
import {
  CANAL_LABEL,
  ESTADOS_PEDIDO,
  ESTADO_PEDIDO_LABEL,
  ESTADO_SOLICITUD_LABEL,
  RESOLUCION_LABEL,
  TIPO_SOLICITUD_LABEL,
  estadoPagoTone,
  estadoPedidoTone,
} from '@/lib/pedidos';
import type { PedidoAdmin, Solicitud } from '@/lib/pedidos';
import { ESTADO_PAGO_LABEL, METODO_PAGO_LABEL } from '@/lib/tienda/checkout';
import { Badge, Btn, Card, Checkbox, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';
import { ClienteEntregaCard, ItemsCard, RecetaCard, Timeline } from '@/components/pedidos/PedidoPartes';

type Accion = 'estado' | 'asignar' | 'email' | 'reembolso' | 'cancelar' | 'nota' | 'solicitud' | null;

export function PedidoDetalle({ inicial, esAdmin }: { inicial: PedidoAdmin; esAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pedido, setPedido] = useState<PedidoAdmin>(inicial);
  const [accion, setAccion] = useState<Accion>(null);
  const [solicitudSel, setSolicitudSel] = useState<Solicitud | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const recargar = useCallback(async () => {
    const fresh = await api.get<PedidoAdmin>(`/admin/pedidos/${pedido.id}`);
    setPedido(fresh);
    router.refresh();
  }, [pedido.id, router]);

  /** Ejecuta una acción contra la API y recarga el detalle. */
  async function ejecutar(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await fn();
      await recargar();
      toast.ok(okMsg);
      setAccion(null);
      setSolicitudSel(null);
      return true;
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const abrir = (a: Accion) => {
    setError(null);
    setFieldErrors({});
    setAccion(a);
  };

  const pagoPendienteTransferencia = pedido.metodoPago === 'TRANSFERENCIA' && pedido.estadoPago !== 'APROBADO' && pedido.estado !== 'CANCELADO';
  const cerrado = pedido.estado === 'CANCELADO' || pedido.estado === 'DEVUELTO';
  const entregado = pedido.estado === 'ENTREGADO' || pedido.estado === 'DEVUELTO';
  const reembolsable = pedido.estadoPago === 'APROBADO' && (pedido.reembolsado ?? 0) < pedido.totales.total;
  const vencido = pedido.estado === 'ASIGNADO' && pedido.aceptarAntesDe && new Date(pedido.aceptarAntesDe).getTime() < Date.now();
  const solicitudesPendientes = (pedido.solicitudes ?? []).filter((s) => s.estado === 'PENDIENTE');

  return (
    <>
      <div className="mb-4 text-sm">
        <Link href="/admin/pedidos" className="text-gris-medio underline-offset-2 hover:underline">
          ← Pedidos
        </Link>
      </div>
      <PageHeader
        title={`Pedido ${pedido.numero}`}
        description={`${formatFecha(pedido.createdAt, true)} · ${CANAL_LABEL[pedido.canal]} · ${METODO_PAGO_LABEL[pedido.metodoPago]}${pedido.cuotas ? ` en ${pedido.cuotas} cuotas` : ''}`}
        actions={
          <>
            {pagoPendienteTransferencia && (
              <>
                <Btn onClick={() => ejecutar(() => api.post(`/admin/pedidos/${pedido.id}/pago/aprobar`, {}), 'Pago confirmado: el pedido se asignó a una óptica')} loading={busy}>
                  Confirmar transferencia
                </Btn>
                <Btn variant="danger" onClick={() => ejecutar(() => api.post(`/admin/pedidos/${pedido.id}/pago/rechazar`, {}), 'Pago rechazado')} loading={busy}>
                  Rechazar pago
                </Btn>
              </>
            )}
            {!cerrado && pedido.estado !== 'PENDIENTE_PAGO' && (
              <Btn variant="secondary" onClick={() => abrir('asignar')}>
                {pedido.entrega.optica ? 'Reasignar óptica' : 'Asignar óptica'}
              </Btn>
            )}
            {!cerrado && pedido.estado !== 'PENDIENTE_PAGO' && (
              <Btn variant="secondary" onClick={() => abrir('estado')}>
                Cambiar estado
              </Btn>
            )}
            <Btn variant="secondary" onClick={() => abrir('email')}>
              Reenviar email
            </Btn>
            {reembolsable && (
              <Btn variant="secondary" onClick={() => abrir('reembolso')}>
                Reembolsar
              </Btn>
            )}
            {!cerrado && !entregado && (
              <Btn variant="danger" onClick={() => abrir('cancelar')}>
                Cancelar pedido
              </Btn>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={estadoPedidoTone(pedido.estado)} className="px-3 py-1 text-sm">{ESTADO_PEDIDO_LABEL[pedido.estado]}</Badge>
        <Badge tone={estadoPagoTone(pedido.estadoPago)} className="px-3 py-1 text-sm">Pago {ESTADO_PAGO_LABEL[pedido.estadoPago].toLowerCase()}</Badge>
        {pedido.entrega.optica ? (
          <Badge tone="neutral" className="px-3 py-1 text-sm">{pedido.entrega.optica.nombre}</Badge>
        ) : pedido.estado === 'PAGADO' ? (
          <Badge tone="danger" className="px-3 py-1 text-sm">Sin óptica que lo cubra</Badge>
        ) : null}
        {vencido && <Badge tone="danger" className="px-3 py-1 text-sm">Plazo de aceptación vencido</Badge>}
        {solicitudesPendientes.length > 0 && (
          <Badge tone="warn" className="px-3 py-1 text-sm">
            {solicitudesPendientes.length === 1 ? 'Solicitud pendiente' : `${solicitudesPendientes.length} solicitudes pendientes`}
          </Badge>
        )}
      </div>

      {error && !accion && <p className="mb-4 rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ItemsCard pedido={pedido} />
          <ClienteEntregaCard pedido={pedido} />
          <RecetaCard receta={pedido.receta} />
          <Card
            title="Línea de tiempo"
            actions={
              <Btn variant="secondary" size="sm" onClick={() => abrir('nota')}>
                Agregar nota interna
              </Btn>
            }
          >
            <Timeline eventos={pedido.eventos ?? []} />
          </Card>
        </div>

        <div className="space-y-4">
          <OpticaCard pedido={pedido} onReasignar={() => abrir('asignar')} />
          <FacturaNotasCard pedido={pedido} onSaved={recargar} />
          <PagoCard pedido={pedido} />
          {(pedido.solicitudes?.length ?? 0) > 0 && (
            <Card title="Cambios y devoluciones">
              <ul className="space-y-3 text-sm">
                {pedido.solicitudes!.map((s) => (
                  <li key={s.id} className="rounded-lg border border-negro/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{TIPO_SOLICITUD_LABEL[s.tipo]}</span>
                      <Badge tone={s.estado === 'PENDIENTE' ? 'warn' : s.estado === 'APROBADA' ? 'ok' : 'neutral'}>{ESTADO_SOLICITUD_LABEL[s.estado]}</Badge>
                    </div>
                    <p className="mt-1">{s.motivo}</p>
                    {s.detalle && <p className="text-xs text-gris-medio">{s.detalle}</p>}
                    <p className="mt-1 text-xs text-gris-medio">{formatFecha(s.createdAt, true)}</p>
                    {s.resolucion && <p className="mt-1 text-xs">Resolución: {RESOLUCION_LABEL[s.resolucion]}</p>}
                    {s.nuevoPedidoId && (
                      <Link href={`/admin/pedidos/${s.nuevoPedidoId}`} className="text-xs underline underline-offset-2">
                        Ver pedido nuevo
                      </Link>
                    )}
                    {s.respuesta && <p className="mt-1 text-xs text-gris-medio">Respuesta: {s.respuesta}</p>}
                    {s.estado === 'PENDIENTE' && (
                      <Btn size="sm" className="mt-2" onClick={() => { setSolicitudSel(s); abrir('solicitud'); }}>
                        Resolver
                      </Btn>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {(pedido.reembolsos?.length ?? 0) > 0 && (
            <Card title="Reembolsos">
              <ul className="space-y-2 text-sm">
                {pedido.reembolsos!.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p>{r.motivo}</p>
                      <p className="text-xs text-gris-medio">
                        {formatFecha(r.createdAt, true)} · {r.proveedor}
                        {r.externoId && <> · <span className="font-mono">{r.externoId}</span></>} · {r.estado.toLowerCase()}
                      </p>
                    </div>
                    <span className="tabular-nums font-medium">{formatPrecio(r.monto)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {esAdmin && (pedido.emails?.length ?? 0) > 0 && (
            <Card title="Emails enviados">
              <ul className="space-y-2 text-xs">
                {pedido.emails!.slice().reverse().map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.asunto}</p>
                      <p className="truncate text-gris-medio">{e.para} · {formatFecha(e.createdAt, true)}</p>
                      {e.error && <p className="text-carey">{e.error}</p>}
                    </div>
                    <Badge tone={e.estado === 'ENVIADO' ? 'ok' : e.estado === 'ERROR' ? 'danger' : 'neutral'}>{e.estado.toLowerCase()}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {/* ---------- Modales ---------- */}
      <EstadoModal open={accion === 'estado'} pedido={pedido} busy={busy} error={error} fieldErrors={fieldErrors} onClose={() => setAccion(null)}
        onSubmit={(body) => ejecutar(() => api.post(`/admin/pedidos/${pedido.id}/estado`, body), 'Estado actualizado y cliente avisado')} />
      <AsignarModal open={accion === 'asignar'} pedido={pedido} busy={busy} error={error} fieldErrors={fieldErrors} onClose={() => setAccion(null)}
        onSubmit={(body) => ejecutar(() => api.post(`/admin/pedidos/${pedido.id}/asignar`, body), 'Pedido reasignado')}
        onAutomatico={() => ejecutar(() => api.post(`/admin/pedidos/${pedido.id}/asignar-automatico`, {}), 'Asignación automática ejecutada')} />
      <EmailModal open={accion === 'email'} pedido={pedido} busy={busy} error={error} onClose={() => setAccion(null)}
        onSubmit={(body) => ejecutar(() => api.post(`/admin/pedidos/${pedido.id}/emails/reenviar`, body), 'Email reenviado')} />
      <ReembolsoModal open={accion === 'reembolso'} pedido={pedido} busy={busy} error={error} fieldErrors={fieldErrors} onClose={() => setAccion(null)}
        onSubmit={(body) => ejecutar(() => api.post(`/admin/pedidos/${pedido.id}/reembolsar`, body), 'Reembolso registrado')} />
      <CancelarModal open={accion === 'cancelar'} pedido={pedido} busy={busy} error={error} fieldErrors={fieldErrors} onClose={() => setAccion(null)}
        onSubmit={(body) => ejecutar(() => api.post(`/admin/pedidos/${pedido.id}/cancelar`, body), 'Pedido cancelado')} />
      <NotaModal open={accion === 'nota'} busy={busy} error={error} fieldErrors={fieldErrors} onClose={() => setAccion(null)}
        onSubmit={(nota) => ejecutar(() => api.post(`/admin/pedidos/${pedido.id}/notas`, { nota }), 'Nota agregada')} />
      <SolicitudModal open={accion === 'solicitud'} solicitud={solicitudSel} busy={busy} error={error} fieldErrors={fieldErrors} onClose={() => { setAccion(null); setSolicitudSel(null); }}
        onAprobar={(body) => ejecutar(() => api.post(`/admin/solicitudes/${solicitudSel!.id}/aprobar`, body), 'Solicitud aprobada')}
        onRechazar={(body) => ejecutar(() => api.post(`/admin/solicitudes/${solicitudSel!.id}/rechazar`, body), 'Solicitud rechazada')} />
    </>
  );
}

// ---------- Tarjetas laterales ----------

function OpticaCard({ pedido, onReasignar }: { pedido: PedidoAdmin; onReasignar: () => void }) {
  const o = pedido.entrega.optica;
  return (
    <Card title="Óptica asignada">
      {o ? (
        <dl className="space-y-1 text-sm">
          <dd className="font-medium">{o.nombre}</dd>
          <dd className="text-gris-medio">{o.direccion}, {o.localidad}</dd>
          {o.whatsapp && <dd className="text-xs">WA {o.whatsapp}</dd>}
          {pedido.asignadoEn && <dd className="text-xs text-gris-medio">Asignado {formatFecha(pedido.asignadoEn, true)}</dd>}
          {pedido.estado === 'ASIGNADO' && pedido.aceptarAntesDe && (
            <dd className="text-xs text-gris-medio">Debe aceptar antes de {formatFecha(pedido.aceptarAntesDe, true)}</dd>
          )}
          {pedido.aceptadoEn && <dd className="text-xs text-gris-medio">Aceptado {formatFecha(pedido.aceptadoEn, true)}</dd>}
          {pedido.entregadoEn && <dd className="text-xs text-gris-medio">Entregado {formatFecha(pedido.entregadoEn, true)}</dd>}
          {pedido.comision?.porcentaje !== null && pedido.comision?.porcentaje !== undefined && (
            <dd className="text-xs text-gris-medio">
              Comisión {pedido.comision.porcentaje}%{pedido.comision.monto !== null ? ` · ${formatPrecio(pedido.comision.monto)}` : ''}
            </dd>
          )}
        </dl>
      ) : (
        <p className="text-sm text-gris-medio">
          {pedido.estado === 'PAGADO'
            ? 'Ninguna óptica activa cubre la dirección del cliente con cupo disponible. Asignalo a mano.'
            : 'Todavía sin óptica.'}
        </p>
      )}
      {(pedido.opticasExcluidas?.length ?? 0) > 0 && (
        <p className="mt-2 text-xs text-gris-medio">
          Rechazado o vencido en {pedido.opticasExcluidas!.length} {pedido.opticasExcluidas!.length === 1 ? 'óptica' : 'ópticas'} (ver línea de tiempo).
        </p>
      )}
      {pedido.estado !== 'PENDIENTE_PAGO' && pedido.estado !== 'CANCELADO' && pedido.estado !== 'DEVUELTO' && (
        <Btn variant="secondary" size="sm" className="mt-3" onClick={onReasignar}>
          {o ? 'Reasignar' : 'Asignar a mano'}
        </Btn>
      )}
    </Card>
  );
}

function FacturaNotasCard({ pedido, onSaved }: { pedido: PedidoAdmin; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [factura, setFactura] = useState(pedido.numeroFactura ?? '');
  const [notas, setNotas] = useState(pedido.notasInternas ?? '');
  const [saving, setSaving] = useState(false);
  async function guardar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/admin/pedidos/${pedido.id}`, { numeroFactura: factura.trim() || null, notasInternas: notas.trim() || null });
      await onSaved();
      toast.ok('Guardado');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card title="Factura y notas internas">
      <form onSubmit={guardar} className="space-y-3">
        <Field label="N.º de factura">
          <Input value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="0001-00001234" />
        </Field>
        <Field label="Notas internas" hint="No las ve el cliente ni la óptica.">
          <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} className="min-h-[72px]" />
        </Field>
        <Btn type="submit" size="sm" variant="secondary" loading={saving}>
          Guardar
        </Btn>
      </form>
    </Card>
  );
}

function PagoCard({ pedido }: { pedido: PedidoAdmin }) {
  return (
    <Card title="Pago">
      <dl className="space-y-1 text-sm">
        <dd>{METODO_PAGO_LABEL[pedido.metodoPago]}{pedido.cuotas ? ` · ${pedido.cuotas} cuotas` : ''}</dd>
        <dd><Badge tone={estadoPagoTone(pedido.estadoPago)}>{ESTADO_PAGO_LABEL[pedido.estadoPago]}</Badge></dd>
        {pedido.pagadoEn && <dd className="text-xs text-gris-medio">Pagado {formatFecha(pedido.pagadoEn, true)}</dd>}
        {pedido.reservaExpiraEn && pedido.estado === 'PENDIENTE_PAGO' && (
          <dd className="text-xs text-gris-medio">Reserva de stock hasta {formatFecha(pedido.reservaExpiraEn, true)}</dd>
        )}
        {pedido.pago?.comprobanteUrl && (
          <dd>
            <a href={pedido.pago.comprobanteUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              Ver comprobante{pedido.pago.comprobanteNombre ? ` (${pedido.pago.comprobanteNombre})` : ''}
            </a>
          </dd>
        )}
      </dl>
      {(pedido.pagos?.length ?? 0) > 0 && (
        <ul className="mt-3 space-y-1 border-t border-negro/10 pt-3 text-xs text-gris-medio">
          {pedido.pagos!.map((p) => (
            <li key={p.id}>
              {formatFecha(p.createdAt, true)} · {p.proveedor} · {p.estado.toLowerCase()} · {formatPrecio(p.monto)}
              {p.externoId && <> · <span className="font-mono">{p.externoId}</span></>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------- Modales ----------

function ErrorBox({ error }: { error: string | null }) {
  return error ? <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{error}</p> : null;
}

function EstadoModal({ open, pedido, busy, error, fieldErrors, onClose, onSubmit }: {
  open: boolean; pedido: PedidoAdmin; busy: boolean; error: string | null; fieldErrors: Record<string, string>;
  onClose: () => void; onSubmit: (body: { estado: string; nota: string | null; numeroSeguimiento: string | null; forzar: boolean }) => Promise<boolean>;
}) {
  const [estado, setEstado] = useState('');
  const [nota, setNota] = useState('');
  const [seguimiento, setSeguimiento] = useState(pedido.numeroSeguimiento ?? '');
  const [forzar, setForzar] = useState(false);
  const opciones = ESTADOS_PEDIDO.filter((e) => e !== 'PENDIENTE_PAGO' && e !== 'CANCELADO' && e !== pedido.estado);
  return (
    <Modal open={open} onClose={onClose} title="Cambiar estado" footer={<><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn type="submit" form="estado-form" loading={busy}>Cambiar</Btn></>}>
      <form id="estado-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void onSubmit({ estado, nota: nota.trim() || null, numeroSeguimiento: seguimiento.trim() || null, forzar }); }}>
        <ErrorBox error={error} />
        <p className="text-sm text-gris-medio">Estado actual: <strong>{ESTADO_PEDIDO_LABEL[pedido.estado]}</strong>. El cliente recibe un email con cada cambio.</p>
        <Field label="Nuevo estado" required error={fieldErrors.estado}>
          <Select value={estado} onChange={(e) => setEstado(e.target.value)} required>
            <option value="">Elegí…</option>
            {opciones.map((e) => <option key={e} value={e}>{ESTADO_PEDIDO_LABEL[e]}</option>)}
          </Select>
        </Field>
        {estado === 'ENVIADO' && (
          <Field label="N.º de seguimiento" error={fieldErrors.numeroSeguimiento}>
            <Input value={seguimiento} onChange={(e) => setSeguimiento(e.target.value)} />
          </Field>
        )}
        <Field label="Nota (queda en la línea de tiempo)" error={fieldErrors.nota}>
          <Textarea value={nota} onChange={(e) => setNota(e.target.value)} className="min-h-[72px]" />
        </Field>
        <Checkbox label="Forzar aunque no sea el paso siguiente de la secuencia" checked={forzar} onChange={(e) => setForzar(e.target.checked)} />
      </form>
    </Modal>
  );
}

function AsignarModal({ open, pedido, busy, error, fieldErrors, onClose, onSubmit, onAutomatico }: {
  open: boolean; pedido: PedidoAdmin; busy: boolean; error: string | null; fieldErrors: Record<string, string>;
  onClose: () => void; onSubmit: (body: { opticaId: string; motivo: string }) => Promise<boolean>; onAutomatico: () => Promise<boolean>;
}) {
  const [opticaId, setOpticaId] = useState('');
  const [motivo, setMotivo] = useState('');
  const candidatas = pedido.candidatas ?? [];
  return (
    <Modal open={open} onClose={onClose} title={pedido.entrega.optica ? 'Reasignar óptica' : 'Asignar óptica'} size="lg"
      footer={<><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn variant="secondary" onClick={() => void onAutomatico()} loading={busy}>Asignación automática</Btn><Btn type="submit" form="asignar-form" loading={busy} disabled={!opticaId}>Asignar</Btn></>}>
      <form id="asignar-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void onSubmit({ opticaId, motivo }); }}>
        <ErrorBox error={error} />
        <p className="text-sm text-gris-medio">
          Ordenadas por distancia al cliente. Las no elegibles (fuera de radio, sin cupo, pausadas o que ya rechazaron) se pueden asignar igual: queda registrado quién y por qué.
        </p>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-negro/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gris-claro/60 text-left text-xs uppercase tracking-wide text-negro/70">
                <th className="px-3 py-2" />
                <th className="px-3 py-2 font-semibold">Óptica</th>
                <th className="px-3 py-2 text-right font-semibold">Distancia</th>
                <th className="px-3 py-2 text-right font-semibold">Cupo hoy</th>
                <th className="px-3 py-2 font-semibold">Situación</th>
              </tr>
            </thead>
            <tbody>
              {candidatas.map((c) => (
                <tr key={c.id} className={c.actual ? 'bg-gris-claro/40' : ''}>
                  <td className="px-3 py-2">
                    <input type="radio" name="optica" value={c.id} checked={opticaId === c.id} onChange={() => setOpticaId(c.id)} disabled={c.actual} aria-label={c.nombre} className="accent-negro" />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{c.nombre}{c.actual && <span className="ml-2 text-xs text-gris-medio">(actual)</span>}</p>
                    <p className="text-xs text-gris-medio">{c.localidad} · radio {c.radioKm} km</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.distanciaKm === null ? '—' : `${c.distanciaKm.toFixed(1)} km`}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.asignadosHoy}/{c.capacidadDiaria}</td>
                  <td className="px-3 py-2">
                    {c.elegible ? <Badge tone="ok">Elegible</Badge> : (
                      <span className="flex flex-wrap gap-1">
                        {!c.activa && <Badge tone="neutral">Pausada</Badge>}
                        {c.activa && !c.dentroRadio && <Badge tone="warn">Fuera de radio</Badge>}
                        {c.activa && !c.conCupo && <Badge tone="warn">Sin cupo</Badge>}
                        {c.excluida && <Badge tone="danger">Rechazó / venció</Badge>}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {candidatas.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-gris-medio">No hay ópticas cargadas.</td></tr>}
            </tbody>
          </table>
        </div>
        <Field label="Motivo de la asignación manual" required error={fieldErrors.motivo}>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} required className="min-h-[64px]" placeholder="Ej. el cliente pidió retirar cerca del trabajo" />
        </Field>
      </form>
    </Modal>
  );
}

function EmailModal({ open, pedido, busy, error, onClose, onSubmit }: {
  open: boolean; pedido: PedidoAdmin; busy: boolean; error: string | null; onClose: () => void; onSubmit: (body: { estado?: string }) => Promise<boolean>;
}) {
  const [estado, setEstado] = useState('');
  const conEmail = ESTADOS_PEDIDO.filter((e) => e !== 'PENDIENTE_PAGO');
  return (
    <Modal open={open} onClose={onClose} title="Reenviar email al cliente" size="sm" footer={<><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn type="submit" form="email-form" loading={busy}>Reenviar</Btn></>}>
      <form id="email-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void onSubmit(estado ? { estado } : {}); }}>
        <ErrorBox error={error} />
        <p className="text-sm text-gris-medio">Se envía a <strong>{pedido.cliente.email}</strong>.</p>
        <Field label="Plantilla">
          <Select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Estado actual ({ESTADO_PEDIDO_LABEL[pedido.estado]})</option>
            {conEmail.map((e) => <option key={e} value={e}>{ESTADO_PEDIDO_LABEL[e]}</option>)}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

function ReembolsoModal({ open, pedido, busy, error, fieldErrors, onClose, onSubmit }: {
  open: boolean; pedido: PedidoAdmin; busy: boolean; error: string | null; fieldErrors: Record<string, string>;
  onClose: () => void; onSubmit: (body: { monto?: number; motivo: string; cancelar?: boolean }) => Promise<boolean>;
}) {
  const pendiente = Math.max(0, pedido.totales.total - (pedido.reembolsado ?? 0));
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [cancelar, setCancelar] = useState(false);
  const esMP = pedido.metodoPago !== 'TRANSFERENCIA';
  const entregado = pedido.estado === 'ENTREGADO' || pedido.estado === 'DEVUELTO';
  return (
    <Modal open={open} onClose={onClose} title="Reembolsar" size="sm" footer={<><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn type="submit" form="reembolso-form" loading={busy}>Reembolsar</Btn></>}>
      <form id="reembolso-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); const m = Number(monto.replace(',', '.')); void onSubmit({ ...(monto.trim() ? { monto: m } : {}), motivo, ...(cancelar ? { cancelar: true } : {}) }); }}>
        <ErrorBox error={error} />
        <p className="text-sm text-gris-medio">
          {esMP ? 'Se ejecuta por la API de Mercado Pago sobre el pago original.' : 'Transferencia: el reintegro se hace a mano y acá sólo queda registrado.'} Pendiente de reembolsar: <strong>{formatPrecio(pendiente)}</strong>.
        </p>
        <Field label="Monto (vacío = total pendiente)" error={fieldErrors.monto}>
          <Input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" placeholder={String(pendiente)} />
        </Field>
        <Field label="Motivo" required error={fieldErrors.motivo}>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} required className="min-h-[64px]" />
        </Field>
        {!entregado && (
          <Checkbox label="Cancelar el pedido y reponer el stock aunque el reembolso sea parcial" checked={cancelar} onChange={(e) => setCancelar(e.target.checked)} />
        )}
        {!entregado && !monto.trim() && <p className="text-xs text-gris-medio">Un reembolso total cancela el pedido y repone el stock.</p>}
      </form>
    </Modal>
  );
}

function CancelarModal({ open, pedido, busy, error, fieldErrors, onClose, onSubmit }: {
  open: boolean; pedido: PedidoAdmin; busy: boolean; error: string | null; fieldErrors: Record<string, string>;
  onClose: () => void; onSubmit: (body: { motivo: string; reembolsar?: boolean }) => Promise<boolean>;
}) {
  const [motivo, setMotivo] = useState('');
  const [reembolsar, setReembolsar] = useState(pedido.estadoPago === 'APROBADO');
  return (
    <Modal open={open} onClose={onClose} title="Cancelar pedido" size="sm" footer={<><Btn variant="secondary" onClick={onClose}>Volver</Btn><Btn variant="danger" type="submit" form="cancelar-form" loading={busy}>Cancelar pedido</Btn></>}>
      <form id="cancelar-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void onSubmit({ motivo, ...(reembolsar ? { reembolsar: true } : {}) }); }}>
        <ErrorBox error={error} />
        <p className="text-sm text-gris-medio">Se repone el stock, se libera la óptica y el cliente recibe un email.</p>
        <Field label="Motivo" required error={fieldErrors.motivo}>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} required className="min-h-[64px]" />
        </Field>
        {pedido.estadoPago === 'APROBADO' && (
          <Checkbox label={pedido.metodoPago === 'TRANSFERENCIA' ? 'Registrar el reintegro (se hace a mano)' : 'Reembolsar por Mercado Pago'} checked={reembolsar} onChange={(e) => setReembolsar(e.target.checked)} />
        )}
      </form>
    </Modal>
  );
}

function NotaModal({ open, busy, error, fieldErrors, onClose, onSubmit }: {
  open: boolean; busy: boolean; error: string | null; fieldErrors: Record<string, string>; onClose: () => void; onSubmit: (nota: string) => Promise<boolean>;
}) {
  const [nota, setNota] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Nota interna" size="sm" footer={<><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn type="submit" form="nota-form" loading={busy}>Agregar</Btn></>}>
      <form id="nota-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void onSubmit(nota).then((ok) => ok && setNota('')); }}>
        <ErrorBox error={error} />
        <Field label="Nota" required error={fieldErrors.nota} hint="Queda en la línea de tiempo con tu nombre. No la ve el cliente ni la óptica.">
          <Textarea value={nota} onChange={(e) => setNota(e.target.value)} required autoFocus />
        </Field>
      </form>
    </Modal>
  );
}

export function SolicitudModal({ open, solicitud, busy, error, fieldErrors, onClose, onAprobar, onRechazar }: {
  open: boolean; solicitud: Solicitud | null; busy: boolean; error: string | null; fieldErrors: Record<string, string>; onClose: () => void;
  onAprobar: (body: { resolucion: string; respuesta: string | null }) => Promise<boolean>; onRechazar: (body: { respuesta: string }) => Promise<boolean>;
}) {
  const [modo, setModo] = useState<'aprobar' | 'rechazar'>('aprobar');
  const [resolucion, setResolucion] = useState<'NUEVO_PEDIDO' | 'REINTEGRO'>('REINTEGRO');
  const [respuesta, setRespuesta] = useState('');
  if (!solicitud) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Resolver ${TIPO_SOLICITUD_LABEL[solicitud.tipo].toLowerCase()}`} size="sm"
      footer={<><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn type="submit" form="solicitud-form" variant={modo === 'rechazar' ? 'danger' : 'primary'} loading={busy}>{modo === 'aprobar' ? 'Aprobar' : 'Rechazar'}</Btn></>}>
      <form id="solicitud-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (modo === 'aprobar') void onAprobar({ resolucion, respuesta: respuesta.trim() || null }); else void onRechazar({ respuesta }); }}>
        <ErrorBox error={error} />
        <p className="text-sm"><strong>{solicitud.motivo}</strong>{solicitud.detalle && <span className="block text-gris-medio">{solicitud.detalle}</span>}</p>
        <div className="flex gap-4 text-sm">
          <label className="inline-flex items-center gap-2"><input type="radio" className="accent-negro" checked={modo === 'aprobar'} onChange={() => setModo('aprobar')} /> Aprobar</label>
          <label className="inline-flex items-center gap-2"><input type="radio" className="accent-negro" checked={modo === 'rechazar'} onChange={() => setModo('rechazar')} /> Rechazar</label>
        </div>
        {modo === 'aprobar' && (
          <Field label="Resolución" required error={fieldErrors.resolucion}>
            <Select value={resolucion} onChange={(e) => setResolucion(e.target.value as 'NUEVO_PEDIDO' | 'REINTEGRO')}>
              <option value="REINTEGRO">{RESOLUCION_LABEL.REINTEGRO} (reembolso total)</option>
              <option value="NUEVO_PEDIDO">{RESOLUCION_LABEL.NUEVO_PEDIDO} (mismos ítems, se asigna a una óptica)</option>
            </Select>
          </Field>
        )}
        <Field label={modo === 'aprobar' ? 'Mensaje para el cliente (opcional)' : 'Motivo del rechazo (lo recibe el cliente)'} required={modo === 'rechazar'} error={fieldErrors.respuesta}>
          <Textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)} required={modo === 'rechazar'} className="min-h-[64px]" />
        </Field>
      </form>
    </Modal>
  );
}
