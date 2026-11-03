'use client';
// Detalle de un pedido para la óptica: aceptar / rechazar con motivo, avanzar estados (en armado,
// listo para retirar, enviado con seguimiento, entregado y ajustado), turnos asociados y línea de tiempo.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { formatFecha, formatPrecio } from '@/lib/format';
import { ESTADO_TURNO_LABEL, TIPO_TURNO_LABEL, estadoPedidoTone, labelEstadoPedido } from '@/lib/pedidos';
import type { EstadoPedido, Pedido } from '@/lib/pedidos';
import { MODALIDAD_LABEL } from '@/lib/tienda/checkout';
import { Badge, Btn, Card, Field, Input, Modal, PageHeader, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';
import { ClienteEntregaCard, ItemsCard, RecetaCard, Timeline } from '@/components/pedidos/PedidoPartes';

type Paso = { estado: 'EN_ARMADO' | 'LISTO' | 'ENVIADO' | 'ENTREGADO'; label: string; ayuda: string };

/** Próximo paso operativo según el estado actual y la modalidad. */
function siguientePaso(estado: EstadoPedido, envio: boolean): Paso | null {
  switch (estado) {
    case 'ACEPTADO':
      return { estado: 'EN_ARMADO', label: 'Marcar en armado', ayuda: 'Empezaste a armar los anteojos.' };
    case 'EN_ARMADO':
      return envio
        ? { estado: 'LISTO', label: 'Listo para despachar', ayuda: 'Los anteojos están terminados; el siguiente paso es enviarlos.' }
        : { estado: 'LISTO', label: 'Listo para retirar', ayuda: 'Se avisa al cliente que puede pasar a retirar y ajustar.' };
    case 'LISTO':
      return envio
        ? { estado: 'ENVIADO', label: 'Marcar enviado', ayuda: 'Ingresá el número de seguimiento del envío.' }
        : { estado: 'ENTREGADO', label: 'Entregado y ajustado', ayuda: 'El cliente retiró y se hizo el ajuste.' };
    case 'ENVIADO':
      return { estado: 'ENTREGADO', label: 'Entregado y ajustado', ayuda: 'El cliente recibió los anteojos.' };
    default:
      return null;
  }
}

export function OpticaPedidoDetalle({ inicial }: { inicial: Pedido }) {
  const router = useRouter();
  const toast = useToast();
  const [pedido, setPedido] = useState<Pedido>(inicial);
  const [modal, setModal] = useState<'rechazar' | 'paso' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [seguimiento, setSeguimiento] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const envio = pedido.entrega.modalidad === 'ENVIO_DOMICILIO';
  const paso = siguientePaso(pedido.estado, envio);
  const vencido = pedido.estado === 'ASIGNADO' && pedido.aceptarAntesDe && new Date(pedido.aceptarAntesDe).getTime() < Date.now();

  async function ejecutar(fn: () => Promise<Pedido | { ok: true }>, okMsg: string, redirigir?: string) {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const r = await fn();
      if (redirigir) {
        toast.ok(okMsg);
        router.push(redirigir);
        router.refresh();
        return;
      }
      if ('id' in r) setPedido(r);
      toast.ok(okMsg);
      setModal(null);
      setNota('');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 text-sm">
        <Link href="/optica/pedidos" className="text-gris-medio underline-offset-2 hover:underline">
          ← Pedidos
        </Link>
      </div>
      <PageHeader
        title={`Pedido ${pedido.numero}`}
        description={`${MODALIDAD_LABEL[pedido.entrega.modalidad]} · asignado ${formatFecha(pedido.asignadoEn, true)}`}
        actions={
          pedido.estado === 'ASIGNADO' ? (
            <>
              <Btn onClick={() => ejecutar(() => api.post<Pedido>(`/optica/pedidos/${pedido.id}/aceptar`), 'Pedido aceptado. ¡A armar!')} loading={busy}>
                Aceptar pedido
              </Btn>
              <Btn variant="danger" onClick={() => { setError(null); setModal('rechazar'); }}>
                No puedo tomarlo
              </Btn>
            </>
          ) : paso ? (
            <Btn onClick={() => { setError(null); setSeguimiento(pedido.numeroSeguimiento ?? ''); setModal('paso'); }}>
              {paso.label}
            </Btn>
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={estadoPedidoTone(pedido.estado)} className="px-3 py-1 text-sm">{labelEstadoPedido(pedido.estado, pedido.entrega.modalidad)}</Badge>
        {pedido.estado === 'ASIGNADO' && pedido.aceptarAntesDe && (
          <Badge tone={vencido ? 'danger' : 'warn'} className="px-3 py-1 text-sm">
            {vencido ? 'Plazo vencido: puede reasignarse en cualquier momento' : `Aceptar antes de ${formatFecha(pedido.aceptarAntesDe, true)}`}
          </Badge>
        )}
        {pedido.receta && <Badge tone="info" className="px-3 py-1 text-sm">Con receta</Badge>}
        {pedido.comision?.porcentaje !== null && pedido.comision?.porcentaje !== undefined && (
          <Badge tone="neutral" className="px-3 py-1 text-sm">
            Comisión {pedido.comision.porcentaje}%{pedido.comision.monto !== null ? ` · ${formatPrecio(pedido.comision.monto)}` : ''}
          </Badge>
        )}
      </div>
      {error && !modal && <p className="mb-4 rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ItemsCard pedido={pedido} />
          <ClienteEntregaCard pedido={pedido} />
          <RecetaCard receta={pedido.receta} />
        </div>
        <div className="space-y-4">
          <Card
            title="Turnos"
            actions={
              <Link href={`/optica/turnos?pedidoId=${pedido.id}&nombre=${encodeURIComponent(pedido.cliente.nombre)}&telefono=${encodeURIComponent(pedido.cliente.telefono ?? '')}`} className="text-xs underline underline-offset-2">
                Agendar turno
              </Link>
            }
          >
            {(pedido.turnos?.length ?? 0) === 0 ? (
              <p className="text-sm text-gris-medio">
                {pedido.receta?.modo === 'OPTICA' ? 'El cliente trae la receta: agendá un turno de medición.' : 'Sin turnos. Para multifocales conviene agendar medición y ajuste.'}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {pedido.turnos!.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span>
                      {TIPO_TURNO_LABEL[t.tipo]} · {formatFecha(t.fecha, true)} ({t.duracionMin} min)
                    </span>
                    <Badge tone={t.estado === 'REALIZADO' ? 'ok' : t.estado === 'CANCELADO' ? 'neutral' : 'info'}>{ESTADO_TURNO_LABEL[t.estado]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Historial">
            <Timeline eventos={pedido.eventos ?? []} ocultarNotas modalidad={pedido.entrega.modalidad} />
          </Card>
        </div>
      </div>

      <Modal
        open={modal === 'rechazar'}
        onClose={() => setModal(null)}
        title="No puedo tomar este pedido"
        size="sm"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setModal(null)}>Volver</Btn>
            <Btn variant="danger" type="submit" form="rechazo-form" loading={busy}>Rechazar</Btn>
          </>
        }
      >
        <form id="rechazo-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void ejecutar(() => api.post<{ ok: true }>(`/optica/pedidos/${pedido.id}/rechazar`, { motivo }), 'Pedido rechazado: pasa a otra óptica', '/optica/pedidos'); }}>
          {error && <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{error}</p>}
          <p className="text-sm text-gris-medio">El pedido pasa a la siguiente óptica más cercana y deja de verse en tu panel. El motivo queda registrado para Vedere.</p>
          <Field label="Motivo" required error={fieldErrors.motivo}>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} required autoFocus placeholder="Ej. sin stock de cristales esta semana" />
          </Field>
        </form>
      </Modal>

      <Modal
        open={modal === 'paso' && !!paso}
        onClose={() => setModal(null)}
        title={paso?.label ?? ''}
        size="sm"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn type="submit" form="paso-form" loading={busy}>Confirmar</Btn>
          </>
        }
      >
        <form
          id="paso-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!paso) return;
            void ejecutar(
              () => api.post<Pedido>(`/optica/pedidos/${pedido.id}/estado`, { estado: paso.estado, nota: nota.trim() || null, numeroSeguimiento: seguimiento.trim() || null }),
              `Pedido ${labelEstadoPedido(paso.estado, pedido.entrega.modalidad).toLowerCase()}. Avisamos al cliente.`,
            );
          }}
        >
          {error && <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{error}</p>}
          <p className="text-sm text-gris-medio">{paso?.ayuda} El cliente recibe un email.</p>
          {paso?.estado === 'ENVIADO' && (
            <Field label="N.º de seguimiento" required error={fieldErrors.numeroSeguimiento}>
              <Input value={seguimiento} onChange={(e) => setSeguimiento(e.target.value)} required autoFocus />
            </Field>
          )}
          <Field label="Nota (opcional)" error={fieldErrors.nota}>
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} className="min-h-[64px]" />
          </Field>
        </form>
      </Modal>
    </>
  );
}
