'use client';
// Carrito del portal mayorista (separado del carrito de la tienda): cantidades, totales con el descuento
// de la óptica e IVA, avance hacia la compra mínima (si no llega no se confirma y dice cuánto falta),
// forma de entrega y confirmación del pedido VM-xxxxx.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@vedere/ui';
import { ApiError, api, errorMessage } from '@/lib/api-client';
import { formatPrecio } from '@/lib/format';
import type { AjusteStock, CarritoMayorista, EntregaMayorista, PedidoMayorista } from '@/lib/mayorista';
import { AJUSTES_KEY, textoAjuste } from '@/lib/mayorista';
import { Btn, Card, EmptyState, LinkBtn, PageHeader, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';
import { CantidadInput, StockLabel } from './piezas';

export function CarritoMayoristaView({ inicial }: { inicial: CarritoMayorista }) {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const [c, setC] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [entrega, setEntrega] = useState<EntregaMayorista | ''>(
    inicial.entrega.envio ? 'ENVIO_TRANSPORTE' : inicial.entrega.retiro ? 'RETIRO_DEPOSITO' : '',
  );
  const [notas, setNotas] = useState('');
  const [avisos, setAvisos] = useState<AjusteStock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const repetidoDe = sp.get('repetido');

  // Avisos que deja "Repetir pedido" (variantes sin stock o ajustadas).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(AJUSTES_KEY);
      if (raw) {
        setAvisos(JSON.parse(raw) as AjusteStock[]);
        sessionStorage.removeItem(AJUSTES_KEY);
      }
    } catch {
      /* sin sessionStorage */
    }
  }, []);

  async function actualizar(items: Array<{ varianteId: string; cantidad: number }>) {
    setGuardando(true);
    setError(null);
    try {
      const r = await api.put<CarritoMayorista>('/optica/mayorista/carrito', { modo: 'reemplazar', items });
      setC(r);
      if (r.ajustes?.length) setAvisos(r.ajustes);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setGuardando(false);
    }
  }

  const cambiar = (varianteId: string, cantidad: number) =>
    actualizar(c.lineas.map((l) => ({ varianteId: l.varianteId, cantidad: l.varianteId === varianteId ? cantidad : l.cantidad })).filter((l) => l.cantidad > 0));

  async function confirmar() {
    if (!entrega) {
      setError('Elegí cómo querés recibir el pedido');
      return;
    }
    setConfirmando(true);
    setError(null);
    try {
      const p = await api.post<PedidoMayorista>('/optica/mayorista/pedidos', {
        entrega,
        notas: notas || null,
        repetidoDeId: repetidoDe || null,
      });
      toast.ok(`Pedido ${p.numero} enviado`);
      router.push(`/optica/compras/${p.id}?nuevo=1`);
      router.refresh();
    } catch (err) {
      setConfirmando(false);
      if (err instanceof ApiError && err.code === 'STOCK_INSUFICIENTE') {
        const r = await api.get<CarritoMayorista>('/optica/mayorista/carrito');
        setC(r);
      }
      setError(errorMessage(err));
    }
  }

  const envioCosto = entrega === 'ENVIO_TRANSPORTE' ? (c.entrega.envio?.costo ?? 0) : 0;
  const ivaEnvio = Math.round(envioCosto * c.ivaPct) / 100;
  const total = c.subtotal + envioCosto + c.iva + ivaEnvio;
  const m = c.minimo;
  const progreso =
    m.tipo === 'NINGUNO' || m.valor <= 0 ? 1 : Math.min(1, (m.tipo === 'UNIDADES' ? c.unidades : c.subtotal) / m.valor);

  return (
    <>
      <PageHeader
        title="Carrito mayorista"
        description="Es el carrito de tu óptica para comprarle a Vedere. No se mezcla con el carrito de la tienda."
        actions={<LinkBtn href="/optica/catalogo" variant="secondary">Seguir comprando</LinkBtn>}
      />

      {avisos.length > 0 && (
        <div role="status" className="mb-4 rounded-lg bg-sol/25 px-4 py-3 text-sm" data-testid="avisos-stock">
          <p className="font-medium">Algunos modelos no se pudieron cargar completos:</p>
          <ul className="mt-1 list-disc pl-5">
            {avisos.map((a) => (
              <li key={a.varianteId + a.sku}>{textoAjuste(a)}</li>
            ))}
          </ul>
        </div>
      )}

      {c.lineas.length === 0 ? (
        <EmptyState
          title="Tu carrito mayorista está vacío"
          description="Cargá cantidades desde el catálogo o repetí un pedido anterior desde Mis compras."
          action={<LinkBtn href="/optica/catalogo">Ir al catálogo</LinkBtn>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="overflow-x-auto rounded-xl border border-negro/10 bg-blanco">
            <table className="w-full min-w-[640px] text-sm" data-testid="carrito-lineas">
              <thead className="border-b border-negro/10 text-left text-xs uppercase tracking-wide text-gris-medio">
                <tr>
                  <th className="px-3 py-2 font-medium">Modelo</th>
                  <th className="px-3 py-2 font-medium">Stock</th>
                  <th className="px-3 py-2 text-right font-medium">Precio s/IVA</th>
                  <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                  <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-negro/5">
                {c.lineas.map((l) => (
                  <tr key={l.varianteId} className={cn(l.cantidad > l.disponible && 'bg-carey/5')}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-12 shrink-0 overflow-hidden rounded bg-gris-claro">
                          {l.imagen && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.imagen} alt="" className="h-full w-full object-contain" />
                          )}
                        </span>
                        <span>
                          <Link href={`/optica/catalogo/${l.slug}`} className="font-medium hover:underline">
                            {l.nombre}
                          </Link>
                          <span className="block text-xs text-gris-medio">
                            {l.color} · <span className="font-mono">{l.sku}</span>
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <StockLabel disponible={l.disponible} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatPrecio(l.precioUnitario)}
                      {l.precioUnitario !== l.precioMayorista && (
                        <span className="block text-xs text-gris-medio line-through">{formatPrecio(l.precioMayorista)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <CantidadInput
                        value={l.cantidad}
                        max={Math.max(l.disponible, 0)}
                        onChange={(n) => n !== l.cantidad && cambiar(l.varianteId, n)}
                        label={`Cantidad de ${l.nombre} ${l.color}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatPrecio(l.total)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => cambiar(l.varianteId, 0)}
                        className="text-xs text-gris-medio underline-offset-2 hover:text-carey hover:underline"
                        disabled={guardando}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {c.problemas.length > 0 && (
              <ul className="list-disc border-t border-negro/10 bg-carey/5 py-2 pl-8 pr-3 text-xs text-carey">
                {c.problemas.map((p) => (
                  <li key={p.varianteId}>{textoAjuste(p)}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            <Card title="Compra mínima">
              <div data-testid="minimo">
                <div className="h-2 overflow-hidden rounded-full bg-gris-claro">
                  <div className={cn('h-full rounded-full', m.cumple ? 'bg-[#2f7d4f]' : 'bg-sol')} style={{ width: `${Math.round(progreso * 100)}%` }} />
                </div>
                <p className={cn('mt-2 text-sm', m.cumple ? 'text-[#2f7d4f]' : 'text-negro')}>
                  {m.tipo === 'NINGUNO' || m.valor <= 0
                    ? 'Tu óptica no tiene compra mínima.'
                    : m.cumple
                      ? 'Llegaste a la compra mínima.'
                      : m.mensaje}
                </p>
              </div>
            </Card>

            <Card title="Entrega">
              <fieldset className="space-y-2 text-sm">
                <legend className="sr-only">Forma de entrega</legend>
                {c.entrega.envio && (
                  <label className={cn('flex cursor-pointer gap-3 rounded-lg border p-3', entrega === 'ENVIO_TRANSPORTE' ? 'border-negro' : 'border-negro/15')}>
                    <input type="radio" name="entrega" checked={entrega === 'ENVIO_TRANSPORTE'} onChange={() => setEntrega('ENVIO_TRANSPORTE')} />
                    <span>
                      <span className="font-medium">Envío por transporte</span>
                      <span className="block text-xs text-gris-medio">{c.entrega.envio.direccion}</span>
                      <span className="block text-xs">
                        {c.entrega.envio.modo === 'A_CARGO_OPTICA' ? 'El flete lo paga la óptica al recibir' : `Costo ${formatPrecio(c.entrega.envio.costo)} + IVA`}
                      </span>
                    </span>
                  </label>
                )}
                {c.entrega.retiro && (
                  <label className={cn('flex cursor-pointer gap-3 rounded-lg border p-3', entrega === 'RETIRO_DEPOSITO' ? 'border-negro' : 'border-negro/15')}>
                    <input type="radio" name="entrega" checked={entrega === 'RETIRO_DEPOSITO'} onChange={() => setEntrega('RETIRO_DEPOSITO')} />
                    <span>
                      <span className="font-medium">Retiro en el depósito</span>
                      <span className="block text-xs text-gris-medio">{c.entrega.retiro.direccion}</span>
                      {c.entrega.retiro.horario && <span className="block text-xs text-gris-medio">{c.entrega.retiro.horario}</span>}
                    </span>
                  </label>
                )}
              </fieldset>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-negro/70">Notas para Vedere</span>
                <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={1000} placeholder="Opcional" />
              </label>
            </Card>

            <Card title="Resumen">
              <dl className="space-y-1.5 text-sm" data-testid="carrito-totales">
                <Fila k={`${c.unidades} ${c.unidades === 1 ? 'unidad' : 'unidades'} a precio de lista`} v={formatPrecio(c.subtotalLista)} />
                {c.descuento > 0 && <Fila k={`Tu descuento (${c.descuentoPct}%)`} v={`− ${formatPrecio(c.descuento)}`} />}
                <Fila k="Subtotal sin IVA" v={formatPrecio(c.subtotal)} fuerte />
                {envioCosto > 0 && <Fila k="Envío" v={formatPrecio(envioCosto)} />}
                <Fila k={`IVA ${c.ivaPct}%`} v={formatPrecio(c.iva + ivaEnvio)} />
                <div className="border-t border-negro/10 pt-2">
                  <Fila k="Total" v={formatPrecio(total)} fuerte />
                </div>
              </dl>
              {error && (
                <p role="alert" className="mt-3 rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey" data-testid="carrito-error">
                  {error}
                </p>
              )}
              <Btn
                className="mt-4 w-full"
                onClick={confirmar}
                loading={confirmando}
                disabled={guardando || !m.cumple || c.problemas.length > 0}
                data-testid="confirmar-pedido"
              >
                Confirmar pedido
              </Btn>
              <p className="mt-2 text-xs text-gris-medio">
                El pedido queda pendiente de aprobación. Te avisamos cuando lo aprobemos y reservemos el stock.
              </p>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function Fila({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-4', fuerte && 'font-semibold')}>
      <dt className={cn(!fuerte && 'text-gris-medio')}>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
