'use client';
// Seguimiento sin cuenta: número de pedido + email (GET /checkout/pedidos/buscar).
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Button, Field, Input, buttonClasses } from '@vedere/ui';
import { formatFecha } from '@/lib/format';
import { mensajeError, tiendaApi } from '@/lib/tienda/client';
import type { PedidoPublico } from '@/lib/tienda/checkout';
import { DatosEntrega, EstadoPedidoBadge, ItemsPedido, OpticaPedido, RecetaPedido, TimelinePedido } from './PedidoResumenCliente';

export function BuscarPedido({ numeroInicial = '' }: { numeroInicial?: string }) {
  const [numero, setNumero] = useState(numeroInicial);
  const [email, setEmail] = useState('');
  const [pedido, setPedido] = useState<PedidoPublico | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscar(e: FormEvent) {
    e.preventDefault();
    setBuscando(true);
    setError(null);
    setPedido(null);
    try {
      const p = await tiendaApi.get<PedidoPublico>(
        `/checkout/pedidos/buscar?numero=${encodeURIComponent(numero.trim().toUpperCase())}&email=${encodeURIComponent(email.trim())}`,
      );
      setPedido(p);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={buscar} className="grid gap-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end" noValidate>
        <Field label="Número de pedido" required hint="Ej. VD-10001">
          {(p) => <Input {...p} value={numero} onChange={(e) => setNumero(e.target.value.toUpperCase())} autoComplete="off" className="uppercase" data-testid="pedido-numero-input" />}
        </Field>
        <Field label="Email de la compra" required>
          {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="pedido-email-input" />}
        </Field>
        <Button type="submit" size="md" loading={buscando} data-testid="pedido-buscar">
          Buscar
        </Button>
      </form>
      {error && (
        <p role="alert" className="rounded-xl bg-carey/15 px-4 py-3 text-sm text-carey">
          {error}
        </p>
      )}

      {pedido && (
        <div className="space-y-6" data-testid="pedido-item">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-lg">
              Pedido <span className="font-semibold" data-testid="pedido-numero">{pedido.numero}</span>{' '}
              <span className="text-sm text-gris-texto">· {formatFecha(pedido.createdAt)}</span>
            </p>
            <span data-testid="pedido-estado">
              <EstadoPedidoBadge pedido={pedido} />
            </span>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-2xl border border-negro/10 p-5">
              <h2 className="text-lg font-semibold">Seguimiento</h2>
              <div className="mt-4">
                <TimelinePedido pedido={pedido} />
              </div>
            </section>
            <div className="space-y-6">
              <section className="rounded-2xl border border-negro/10 p-5">
                <h2 className="text-lg font-semibold">{pedido.entrega.modalidad === 'RETIRO_OPTICA' ? 'Retirás en' : 'Tu óptica socia'}</h2>
                <div className="mt-3">
                  <OpticaPedido pedido={pedido} />
                </div>
              </section>
              <section className="rounded-2xl border border-negro/10 p-5">
                <h2 className="text-lg font-semibold">{pedido.entrega.modalidad === 'RETIRO_OPTICA' ? 'Tu dirección' : 'Enviamos a'}</h2>
                <div className="mt-3">
                  <DatosEntrega pedido={pedido} />
                </div>
              </section>
              {pedido.receta && (
                <section className="rounded-2xl border border-negro/10 p-5">
                  <h2 className="text-lg font-semibold">Receta</h2>
                  <div className="mt-3">
                    <RecetaPedido pedido={pedido} />
                  </div>
                </section>
              )}
            </div>
          </div>
          <section className="rounded-2xl border border-negro/10 p-5">
            <h2 className="text-lg font-semibold">Productos</h2>
            <div className="mt-3">
              <ItemsPedido pedido={pedido} />
            </div>
          </section>
          <div className="flex flex-wrap gap-3">
            {pedido.metodoPago === 'TRANSFERENCIA' && pedido.estadoPago !== 'APROBADO' && (
              <Link href={`/gracias/${pedido.id}`} className={buttonClasses('primary', 'md')}>
                Ver datos de transferencia
              </Link>
            )}
            {(pedido.estado === 'LISTO' || pedido.estado === 'ENVIADO' || pedido.estado === 'ENTREGADO') && (
              <Link href={`/cambios-y-devoluciones?pedido=${encodeURIComponent(pedido.numero)}`} className={buttonClasses('secondary', 'md')}>
                Pedir un cambio o devolución
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
