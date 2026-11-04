'use client';
// Mis compras mayoristas: listado con estado y pago; detalle con línea de tiempo, seguimiento, factura,
// remito, estado de pago, "Repetir pedido" (carga el carrito ajustando por stock) y devoluciones.
import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { formatFecha, formatPrecio } from '@/lib/format';
import type { CarritoMayorista, PedidoMayorista } from '@/lib/mayorista';
import { AJUSTES_KEY, ENTREGA_LABEL, ESTADO_DEVOLUCION, ESTADO_MAYORISTA, ESTADO_PAGO, numeroRemito } from '@/lib/mayorista';
import type { Paged } from '@/components/admin/table';
import { FilterSelect, Pagination, SearchInput, Table, Td, Th, Toolbar, Tr } from '@/components/admin/table';
import { Badge, Btn, Card, EmptyState, Field, Input, LinkBtn, Modal, PageHeader, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';
import { LineaDeTiempo } from '@/components/admin/mayorista/PedidosMayoristas';

const linkBtn = 'inline-flex h-10 items-center rounded-lg border border-negro/20 bg-blanco px-4 text-sm font-medium hover:bg-gris-claro';
const DEVOLVIBLES = ['LISTO_PARA_RETIRO', 'DESPACHADO', 'ENTREGADO'];

function PagoBadge({ p }: { p: PedidoMayorista }) {
  if (p.estadoPago === 'NO_APLICA') return <span className="text-gris-medio">—</span>;
  return <Badge tone={p.vencido ? 'danger' : ESTADO_PAGO[p.estadoPago].tone}>{p.vencido ? 'Vencido' : ESTADO_PAGO[p.estadoPago].label}</Badge>;
}

export function ComprasTable({ data }: { data: Paged<PedidoMayorista> }) {
  return (
    <>
      <PageHeader
        title="Mis compras"
        description="Los pedidos mayoristas de tu óptica a Vedere."
        actions={
          <>
            <LinkBtn href="/optica/cuenta" variant="secondary">
              Cuenta corriente
            </LinkBtn>
            <LinkBtn href="/optica/catalogo">Nuevo pedido</LinkBtn>
          </>
        }
      />
      <Toolbar>
        <SearchInput placeholder="Número o SKU…" />
        <FilterSelect param="estado" label="Estado" options={Object.entries(ESTADO_MAYORISTA).map(([value, e]) => ({ value, label: e.label }))} />
      </Toolbar>
      {data.items.length === 0 ? (
        <EmptyState
          title="Todavía no hay compras"
          description="Cuando confirmes un pedido desde el carrito mayorista lo vas a ver acá."
          action={<LinkBtn href="/optica/catalogo">Ver catálogo</LinkBtn>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Pedido</Th>
              <Th>Fecha</Th>
              <Th>Estado</Th>
              <Th>Pago</Th>
              <Th>Entrega</Th>
              <Th align="right">Unidades</Th>
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <Link href={`/optica/compras/${p.id}`} className="font-medium hover:underline">
                    {p.numero}
                  </Link>
                  <span className="block text-xs text-gris-medio">{p.usuarioNombre}</span>
                </Td>
                <Td>{formatFecha(p.createdAt)}</Td>
                <Td>
                  <Badge tone={ESTADO_MAYORISTA[p.estado].tone}>{ESTADO_MAYORISTA[p.estado].label}</Badge>
                </Td>
                <Td>
                  <PagoBadge p={p} />
                  {p.venceEn && p.estadoPago !== 'PAGADO' && <span className="block text-xs text-gris-medio">vence {formatFecha(p.venceEn)}</span>}
                </Td>
                <Td>{ENTREGA_LABEL[p.entrega]}</Td>
                <Td align="right">{p.unidades}</Td>
                <Td align="right">{formatPrecio(p.total)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} />
    </>
  );
}

function BannerConfirmado({ p }: { p: PedidoMayorista }) {
  const aprobado = p.estado === 'APROBADO';
  return (
    <div
      role="status"
      className={aprobado ? 'mb-4 rounded-lg bg-[#2f7d4f]/10 px-4 py-3 text-sm text-[#2f7d4f]' : 'mb-4 rounded-lg bg-[#b7791f]/10 px-4 py-3 text-sm text-[#8a5a12]'}
      data-testid="pedido-confirmado"
    >
      {aprobado ? (
        <>
          ¡Listo! Recibimos y aprobamos el pedido <strong>{p.numero}</strong>: reservamos el stock y lo empezamos a preparar.
        </>
      ) : (
        <>
          Recibimos el pedido <strong>{p.numero}</strong>. Lo revisa nuestro equipo comercial antes de aprobarlo
          {p.motivoRevision ? `: ${p.motivoRevision}.` : '.'} Te avisamos por email.
        </>
      )}
    </div>
  );
}

export function CompraDetalle({ pedido, nuevo }: { pedido: PedidoMayorista; nuevo: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState(pedido);
  const [repitiendo, setRepitiendo] = useState(false);
  const [devolver, setDevolver] = useState(false);

  async function repetir() {
    setRepitiendo(true);
    try {
      const r = await api.post<CarritoMayorista>(`/optica/mayorista/pedidos/${p.id}/repetir`);
      try {
        if (r.ajustes?.length) sessionStorage.setItem(AJUSTES_KEY, JSON.stringify(r.ajustes));
      } catch {
        /* sin sessionStorage */
      }
      toast.ok(r.ajustes?.length ? 'Cargamos el pedido; algunos modelos no tienen stock' : 'Cargamos el pedido en el carrito');
      router.push(`/optica/carrito?repetido=${p.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setRepitiendo(false);
    }
  }

  const e = ESTADO_MAYORISTA[p.estado];
  return (
    <>
      <nav className="mb-4 text-sm text-gris-medio">
        <Link href="/optica/compras" className="hover:underline">
          Mis compras
        </Link>{' '}
        / <span className="text-negro">{p.numero}</span>
      </nav>
      {nuevo && <BannerConfirmado p={p} />}
      <PageHeader
        title={`Pedido ${p.numero}`}
        description={`Hecho el ${formatFecha(p.createdAt, true)} por ${p.usuarioNombre}`}
        actions={
          <>
            {DEVOLVIBLES.includes(p.estado) && (
              <Btn variant="secondary" onClick={() => setDevolver(true)} data-testid="pedir-devolucion">
                Pedir devolución
              </Btn>
            )}
            {p.numeroRemito && (
              <a href={`/api/optica/mayorista/pedidos/${p.id}/remito.pdf`} target="_blank" rel="noopener" className={linkBtn}>
                Remito {numeroRemito(p.numeroRemito)}
              </a>
            )}
            <Btn onClick={repetir} loading={repitiendo} data-testid="repetir-pedido">
              Repetir pedido
            </Btn>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Modelos">
            <div className="-mx-5 -my-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm" data-testid="compra-items">
                <thead className="border-b border-negro/10 text-left text-xs uppercase tracking-wide text-gris-medio">
                  <tr>
                    <th className="px-5 py-2 font-medium">Modelo</th>
                    <th className="px-3 py-2 text-right font-medium">Precio s/IVA</th>
                    <th className="px-3 py-2 text-right font-medium">Cant.</th>
                    <th className="px-5 py-2 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-negro/5">
                  {p.items.map((i) => (
                    <tr key={i.id}>
                      <td className="px-5 py-2">
                        <span className="font-medium">{i.nombre}</span>
                        <span className="block text-xs text-gris-medio">
                          {i.color} · <span className="font-mono">{i.sku}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatPrecio(i.precioUnitario)}
                        {i.descuentoPct > 0 && <span className="block text-xs text-gris-medio">lista {formatPrecio(i.precioMayorista)}</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{i.cantidad}</td>
                      <td className="px-5 py-2 text-right font-medium tabular-nums">{formatPrecio(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {(p.devoluciones?.length ?? 0) > 0 && (
            <Card title="Devoluciones">
              <ul className="space-y-3 text-sm" data-testid="mis-devoluciones">
                {p.devoluciones!.map((d) => (
                  <li key={d.id} className="rounded-lg border border-negro/10 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={ESTADO_DEVOLUCION[d.estado].tone}>{ESTADO_DEVOLUCION[d.estado].label}</Badge>
                      <span className="text-xs text-gris-medio">{formatFecha(d.createdAt, true)}</span>
                      <span className="ml-auto tabular-nums">{formatPrecio(d.importe)}</span>
                    </div>
                    <p className="mt-1">{d.motivo}</p>
                    <p className="text-xs text-gris-medio">{d.items.map((i) => `${i.cantidad} × ${i.sku}`).join(', ')}</p>
                    {d.estado === 'APROBADA' && <p className="mt-1 text-xs text-[#2f7d4f]">Te acreditamos la nota de crédito en tu cuenta corriente.</p>}
                    {d.motivoRechazo && <p className="mt-1 text-xs text-carey">{d.motivoRechazo}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Seguimiento">
            <LineaDeTiempo p={p} />
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Estado">
            <Badge tone={e.tone}>{e.label}</Badge>
            {p.motivoRevision && p.estado === 'EN_REVISION' && <p className="mt-2 text-sm text-gris-medio">{p.motivoRevision}</p>}
            {p.motivoCancelacion && <p className="mt-2 text-sm text-carey">Motivo: {p.motivoCancelacion}</p>}
            {p.numeroFactura && <p className="mt-2 text-sm">Factura {p.numeroFactura}</p>}
          </Card>
          <Card title="Pago">
            {p.estadoPago === 'NO_APLICA' ? (
              <p className="text-sm text-gris-medio">
                Se carga en tu cuenta corriente cuando sale del depósito, con {p.plazoPagoDias ?? 30} días para pagarlo.
              </p>
            ) : (
              <dl className="space-y-1.5 text-sm" data-testid="compra-pago">
                <Fila k="Estado" v={<PagoBadge p={p} />} />
                <Fila k="Vence" v={formatFecha(p.venceEn)} />
                <Fila k="Pagado" v={formatPrecio(p.pagado)} />
                <Fila k="Pendiente" v={formatPrecio(p.pendiente)} />
              </dl>
            )}
          </Card>
          <Card title="Entrega">
            <p className="text-sm font-medium">{ENTREGA_LABEL[p.entrega]}</p>
            <p className="text-sm text-gris-medio">{p.direccionEntrega}</p>
            {p.envioACargoOptica && <p className="mt-1 text-xs">El flete lo paga la óptica al recibir.</p>}
            {p.transporte && (
              <p className="mt-2 text-sm">
                {p.transporte}
                {p.numeroSeguimiento && ` · guía ${p.numeroSeguimiento}`}
              </p>
            )}
            {p.linkSeguimiento && (
              <a href={p.linkSeguimiento} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm underline underline-offset-2">
                Seguir el envío
              </a>
            )}
            {p.notas && <p className="mt-2 text-sm">Notas: {p.notas}</p>}
          </Card>
          <Card title="Importes">
            <dl className="space-y-1.5 text-sm" data-testid="compra-totales">
              <Fila k={`${p.unidades} unidades a lista`} v={formatPrecio(p.subtotalLista)} />
              {p.descuento > 0 && <Fila k={`Descuento (${p.descuentoPct}%)`} v={`− ${formatPrecio(p.descuento)}`} />}
              <Fila k="Subtotal sin IVA" v={formatPrecio(p.subtotal)} />
              {p.envio > 0 && <Fila k="Envío" v={formatPrecio(p.envio)} />}
              <Fila k={`IVA ${p.ivaPct}%`} v={formatPrecio(p.iva)} />
              <div className="border-t border-negro/10 pt-2 font-semibold">
                <Fila k="Total" v={formatPrecio(p.total)} />
              </div>
            </dl>
          </Card>
        </div>
      </div>
      {devolver && <PedirDevolucion p={p} onClose={() => setDevolver(false)} onCreada={setP} />}
    </>
  );
}

function PedirDevolucion({ p, onClose, onCreada }: { p: PedidoMayorista; onClose: () => void; onCreada: (p: PedidoMayorista) => void }) {
  const toast = useToast();
  // Lo ya devuelto o en trámite no se puede volver a pedir.
  const yaDevuelto = new Map<string, number>();
  for (const d of p.devoluciones ?? []) {
    if (d.estado === 'RECHAZADA') continue;
    for (const i of d.items) yaDevuelto.set(i.pedidoItemId, (yaDevuelto.get(i.pedidoItemId) ?? 0) + i.cantidad);
  }
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unidades = Object.values(cantidades).reduce((a, v) => a + (Number(v) || 0), 0);

  async function subir(files: FileList) {
    setSubiendo(true);
    setError(null);
    try {
      for (const f of Array.from(files).slice(0, 6 - fotos.length)) {
        const fd = new FormData();
        fd.append('file', f);
        const r = await api.post<{ url: string }>('/optica/mayorista/devoluciones/fotos', fd);
        setFotos((xs) => [...xs, r.url]);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubiendo(false);
    }
  }

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const r = await api.post<{ pedido: PedidoMayorista }>(`/optica/mayorista/pedidos/${p.id}/devoluciones`, {
        motivo,
        fotos,
        items: Object.entries(cantidades)
          .map(([itemId, v]) => ({ itemId, cantidad: Number(v) || 0 }))
          .filter((i) => i.cantidad > 0),
      });
      onCreada(r.pedido);
      toast.ok('Recibimos tu pedido de devolución');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Devolución del pedido ${p.numero}`}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancelar
          </Btn>
          <Btn onClick={enviar} loading={enviando} disabled={unidades === 0 || motivo.trim().length < 5 || subiendo} data-testid="enviar-devolucion">
            Pedir devolución
          </Btn>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-gris-medio">Elegí qué modelos y cuántas unidades devolvés. Cuando la aprobemos, te acreditamos una nota de crédito en tu cuenta corriente.</p>
        <ul className="space-y-2">
          {p.items.map((i) => {
            const max = i.cantidad - (yaDevuelto.get(i.id) ?? 0);
            return (
              <li key={i.id} className="flex items-center gap-3">
                <span className="flex-1">
                  {i.nombre} {i.color} <span className="font-mono text-xs text-gris-medio">{i.sku}</span>
                  <span className="block text-xs text-gris-medio">Hasta {max} de {i.cantidad}</span>
                </span>
                <Input
                  type="number"
                  min={0}
                  max={max}
                  disabled={max === 0}
                  value={cantidades[i.id] ?? ''}
                  onChange={(e) => setCantidades({ ...cantidades, [i.id]: e.target.value })}
                  className="w-20"
                  aria-label={`Unidades a devolver de ${i.sku}`}
                />
              </li>
            );
          })}
        </ul>
        <Field label="Motivo" required>
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Llegó rayado, falla de fábrica, modelo equivocado…" data-testid="devolucion-motivo" />
        </Field>
        <Field label="Fotos" hint="Hasta 6 fotos del problema.">
          <input type="file" accept="image/*" multiple onChange={(e) => e.target.files && subir(e.target.files)} disabled={fotos.length >= 6} aria-label="Fotos" />
          {subiendo && <span className="ml-2 text-xs text-gris-medio">Subiendo…</span>}
          {fotos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {fotos.map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f} src={f} alt="" className="h-14 w-14 rounded-md border border-negro/10 object-cover" />
              ))}
            </div>
          )}
        </Field>
        {error && (
          <p role="alert" className="rounded-lg bg-carey/10 px-3 py-2 text-carey">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function Fila({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
