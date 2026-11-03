'use client';
// Solicitud de cambio o devolución desde la tienda: el cliente busca su pedido por número + email,
// ve el estado y envía la solicitud (tipo, motivo, detalle). El equipo la resuelve en el backoffice.
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Button, Field, Input, Select, Textarea } from '@vedere/ui';
import { formatFecha, formatPrecio } from '@/lib/format';
import { ESTADO_SOLICITUD_LABEL, RESOLUCION_LABEL, TIPO_SOLICITUD_LABEL } from '@/lib/pedidos';
import type { Solicitud, TipoSolicitud } from '@/lib/pedidos';
import { ESTADO_PEDIDO_LABEL } from '@/lib/tienda/checkout';
import type { EstadoPedido } from '@/lib/tienda/checkout';
import { erroresPorCampo, mensajeError, tiendaApi } from '@/lib/tienda/client';

interface PedidoCliente {
  id: string;
  numero: string;
  estado: EstadoPedido;
  createdAt: string;
  entregadoEn: string | null;
  items: Array<{ id: string; nombre: string; color: string | null; cantidad: number }>;
  totales: { total: number };
  entrega: { optica: { nombre: string; direccion: string; localidad: string } | null };
  solicitudes?: Solicitud[];
}

const PUEDE_SOLICITAR: EstadoPedido[] = ['LISTO', 'ENVIADO', 'ENTREGADO'];

export function SolicitudCambioForm({ numeroInicial = '' }: { numeroInicial?: string }) {
  const [numero, setNumero] = useState(numeroInicial);
  const [email, setEmail] = useState('');
  const [pedido, setPedido] = useState<PedidoCliente | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  const [tipo, setTipo] = useState<TipoSolicitud>('CAMBIO');
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [web, setWeb] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok'>('idle');

  async function buscar(e: FormEvent) {
    e.preventDefault();
    setBuscando(true);
    setErrorBusqueda(null);
    setPedido(null);
    setEstado('idle');
    try {
      const p = await tiendaApi.get<PedidoCliente>(
        `/checkout/pedidos/buscar?numero=${encodeURIComponent(numero.trim())}&email=${encodeURIComponent(email.trim())}`,
      );
      setPedido(p);
    } catch (err) {
      setErrorBusqueda(mensajeError(err));
    } finally {
      setBuscando(false);
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!pedido) return;
    setEstado('enviando');
    setErrores({});
    setGeneral(null);
    try {
      const r = await tiendaApi.post<{ solicitud: Solicitud }>(`/checkout/pedidos/${pedido.id}/solicitudes`, {
        tipo,
        motivo: motivo.trim(),
        detalle: detalle.trim() || null,
        email: email.trim(),
        web,
      });
      setPedido({ ...pedido, solicitudes: [...(pedido.solicitudes ?? []), r.solicitud] });
      setEstado('ok');
    } catch (err) {
      setEstado('idle');
      setErrores(erroresPorCampo(err));
      setGeneral(mensajeError(err));
    }
  }

  const pendiente = pedido?.solicitudes?.find((s) => s.estado === 'PENDIENTE');
  const puede = pedido ? PUEDE_SOLICITAR.includes(pedido.estado) : false;

  return (
    <div className="font-text space-y-6">
      <form onSubmit={buscar} className="rounded-3xl border border-negro/10 p-6" noValidate>
        <h3 className="text-xl font-semibold">Buscá tu pedido</h3>
        <p className="mt-1 text-sm text-gris-texto">Con el número de pedido y el email de la compra.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
          <Field label="Número de pedido" required>
            {(p) => <Input {...p} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="VD-10001" autoComplete="off" />}
          </Field>
          <Field label="Email" required>
            {(p) => <Input {...p} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}
          </Field>
          <Button type="submit" loading={buscando}>
            Buscar
          </Button>
        </div>
        {errorBusqueda && (
          <p role="alert" className="mt-3 rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
            {errorBusqueda}
          </p>
        )}
      </form>

      {pedido && (
        <div className="rounded-3xl bg-gris-claro p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xl font-semibold">Pedido {pedido.numero}</h3>
            <span className="text-sm text-gris-texto">
              {formatFecha(pedido.createdAt)} · {ESTADO_PEDIDO_LABEL[pedido.estado]} · {formatPrecio(pedido.totales.total)}
            </span>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {pedido.items.map((i) => (
              <li key={i.id}>
                {i.cantidad} × {i.nombre}
                {i.color ? ` · ${i.color}` : ''}
              </li>
            ))}
          </ul>
          {pedido.entrega.optica && (
            <p className="mt-2 text-sm text-gris-texto">
              Óptica: {pedido.entrega.optica.nombre}, {pedido.entrega.optica.direccion}, {pedido.entrega.optica.localidad}
            </p>
          )}

          {(pedido.solicitudes?.length ?? 0) > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold">Tus solicitudes</p>
              {pedido.solicitudes!.map((s) => (
                <div key={s.id} className="rounded-2xl bg-blanco px-4 py-3 text-sm">
                  <p>
                    <strong>{TIPO_SOLICITUD_LABEL[s.tipo]}</strong> · {formatFecha(s.createdAt)} ·{' '}
                    <span className={s.estado === 'APROBADA' ? 'text-negro' : s.estado === 'RECHAZADA' ? 'text-carey' : 'text-gris-texto'}>
                      {ESTADO_SOLICITUD_LABEL[s.estado]}
                    </span>
                  </p>
                  <p className="text-gris-texto">{s.motivo}</p>
                  {s.resolucion && <p className="mt-1">{RESOLUCION_LABEL[s.resolucion]}</p>}
                  {s.respuesta && <p className="mt-1 text-gris-texto">Vedere: {s.respuesta}</p>}
                </div>
              ))}
            </div>
          )}

          {estado === 'ok' ? (
            <div role="status" className="mt-5 rounded-2xl bg-vetro/50 p-5">
              <p className="font-campaign text-3xl">¡Recibido!</p>
              <p className="mt-2 text-sm">Te mandamos un email de confirmación. Te respondemos en hasta 2 días hábiles con los pasos a seguir.</p>
            </div>
          ) : pendiente ? (
            <p className="mt-5 text-sm">Ya tenés una solicitud pendiente para este pedido. Te escribimos apenas la resolvamos.</p>
          ) : !puede ? (
            <p className="mt-5 text-sm">
              Los cambios y devoluciones se piden una vez que el pedido está listo, enviado o entregado. Si necesitás otra cosa,{' '}
              <Link href="/contacto" className="underline underline-offset-4">escribinos</Link>.
            </p>
          ) : (
            <form onSubmit={enviar} className="mt-5 space-y-4" noValidate>
              {general && (
                <p role="alert" className="rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
                  {general}
                </p>
              )}
              <Field label="¿Qué necesitás?" required error={errores.tipo}>
                {(p) => (
                  <Select {...p} value={tipo} onChange={(e) => setTipo(e.target.value as TipoSolicitud)}>
                    <option value="CAMBIO">Cambio por otro talle, color o modelo</option>
                    <option value="DEVOLUCION">Devolución con reintegro</option>
                  </Select>
                )}
              </Field>
              <Field label="Motivo" required error={errores.motivo}>
                {(p) => <Input {...p} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. me quedan grandes" maxLength={200} />}
              </Field>
              <Field label="Contanos más" hint="Opcional: qué modelo o color preferís, o qué pasó." error={errores.detalle}>
                {(p) => <Textarea {...p} value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={3} maxLength={2000} />}
              </Field>
              <input type="text" name="web" value={web} onChange={(e) => setWeb(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
              <Button type="submit" loading={estado === 'enviando'}>
                Enviar solicitud
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
