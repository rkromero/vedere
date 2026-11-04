'use client';
// Backoffice: pedidos mayoristas de las ópticas. Aprobar reserva el stock (el mismo de la tienda),
// despachar lo descuenta, cancelar libera la reserva.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api-client';
import { formatFecha, formatPrecio } from '@/lib/format';
import type { PedidoMayorista } from '@/lib/mayorista';
import { ENTREGA_LABEL, ESTADO_MAYORISTA } from '@/lib/mayorista';
import type { Paged } from '@/components/admin/table';
import { FilterSelect, Pagination, SearchInput, Table, Td, Th, Toolbar, Tr } from '@/components/admin/table';
import { Badge, Btn, Card, EmptyState, Field, Input, Modal, PageHeader, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';

export function PedidosMayoristasTable({ data }: { data: Paged<PedidoMayorista> & { resumen: Partial<Record<string, number>> } }) {
  return (
    <>
      <PageHeader
        title="Pedidos mayoristas"
        description="Compras de las ópticas socias. Al aprobar se reserva el stock; al despachar se descuenta."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(ESTADO_MAYORISTA).map(([k, e]) => (
          <Badge key={k} tone={e.tone}>
            {e.label}: {data.resumen[k] ?? 0}
          </Badge>
        ))}
      </div>
      <Toolbar>
        <SearchInput placeholder="Número, óptica o email…" />
        <FilterSelect
          param="estado"
          label="Estado"
          options={Object.entries(ESTADO_MAYORISTA).map(([value, e]) => ({ value, label: e.label }))}
        />
      </Toolbar>
      {data.items.length === 0 ? (
        <EmptyState title="No hay pedidos mayoristas" description="Cuando una óptica confirme un pedido desde su portal aparece acá." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Pedido</Th>
              <Th>Óptica</Th>
              <Th>Fecha</Th>
              <Th>Estado</Th>
              <Th align="right">Unidades</Th>
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <Link href={`/admin/mayorista/${p.id}`} className="font-medium hover:underline">
                    {p.numero}
                  </Link>
                </Td>
                <Td>
                  {p.optica.nombre}
                  <span className="block text-xs text-gris-medio">{p.usuarioEmail}</span>
                </Td>
                <Td>{formatFecha(p.createdAt, true)}</Td>
                <Td>
                  <Badge tone={ESTADO_MAYORISTA[p.estado].tone}>{ESTADO_MAYORISTA[p.estado].label}</Badge>
                </Td>
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

type Accion = 'aprobar' | 'cancelar' | 'despachar' | 'entregar';

export function PedidoMayoristaAdmin({ inicial }: { inicial: PedidoMayorista }) {
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState(inicial);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [motivo, setMotivo] = useState('');
  const [seguimiento, setSeguimiento] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar() {
    if (!accion) return;
    setEnviando(true);
    setError(null);
    try {
      const body = accion === 'cancelar' ? { motivo } : accion === 'despachar' ? { numeroSeguimiento: seguimiento || null } : {};
      const r = await api.post<PedidoMayorista>(`/admin/mayorista/pedidos/${p.id}/${accion}`, body);
      setP(r);
      setAccion(null);
      toast.ok(`Pedido ${ESTADO_MAYORISTA[r.estado].label.toLowerCase()}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  const e = ESTADO_MAYORISTA[p.estado];
  const titulos: Record<Accion, string> = {
    aprobar: `Aprobar ${p.numero}`,
    cancelar: `Cancelar ${p.numero}`,
    despachar: `Despachar ${p.numero}`,
    entregar: `Marcar ${p.numero} como entregado`,
  };
  return (
    <>
      <nav className="mb-4 text-sm text-gris-medio">
        <Link href="/admin/mayorista" className="hover:underline">
          Pedidos mayoristas
        </Link>{' '}
        / <span className="text-negro">{p.numero}</span>
      </nav>
      <PageHeader
        title={`Pedido ${p.numero}`}
        description={`${p.optica.nombre} · ${formatFecha(p.createdAt, true)} · ${p.usuarioNombre} (${p.usuarioEmail})`}
        actions={
          <>
            {p.estado === 'PENDIENTE_APROBACION' && (
              <Btn onClick={() => setAccion('aprobar')} data-testid="mayorista-aprobar">
                Aprobar y reservar stock
              </Btn>
            )}
            {p.estado === 'APROBADO' && <Btn onClick={() => setAccion('despachar')}>Despachar</Btn>}
            {p.estado === 'DESPACHADO' && <Btn onClick={() => setAccion('entregar')}>Marcar entregado</Btn>}
            {(p.estado === 'PENDIENTE_APROBACION' || p.estado === 'APROBADO') && (
              <Btn variant="danger" onClick={() => setAccion('cancelar')}>
                Cancelar
              </Btn>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card title="Ítems (precios congelados, sin IVA)">
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="border-b border-negro/10 text-left text-xs uppercase tracking-wide text-gris-medio">
                <tr>
                  <th className="px-5 py-2 font-medium">Modelo</th>
                  <th className="px-3 py-2 text-right font-medium">Lista</th>
                  <th className="px-3 py-2 text-right font-medium">Precio</th>
                  <th className="px-3 py-2 text-right font-medium">Cant.</th>
                  <th className="px-5 py-2 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-negro/5">
                {p.items.map((i) => (
                  <tr key={i.id}>
                    <td className="px-5 py-2">
                      {i.nombre}
                      <span className="block text-xs text-gris-medio">
                        {i.color} · <span className="font-mono">{i.sku}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gris-medio">{formatPrecio(i.precioMayorista)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPrecio(i.precioUnitario)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.cantidad}</td>
                    <td className="px-5 py-2 text-right font-medium tabular-nums">{formatPrecio(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Estado">
            <Badge tone={e.tone}>{e.label}</Badge>
            {p.motivoCancelacion && <p className="mt-2 text-sm text-carey">Motivo: {p.motivoCancelacion}</p>}
            {p.numeroSeguimiento && <p className="mt-2 text-sm">Seguimiento: {p.numeroSeguimiento}</p>}
          </Card>
          <Card title="Entrega">
            <p className="text-sm font-medium">{ENTREGA_LABEL[p.entrega]}</p>
            <p className="text-sm text-gris-medio">{p.direccionEntrega}</p>
            {p.envioACargoOptica && <p className="mt-1 text-xs">Flete a cargo de la óptica.</p>}
            {p.notas && <p className="mt-2 text-sm">Notas de la óptica: {p.notas}</p>}
          </Card>
          <Card title="Importes">
            <dl className="space-y-1 text-sm">
              <Fila k="Lista" v={formatPrecio(p.subtotalLista)} />
              <Fila k={`Descuento ${p.descuentoPct}%`} v={`− ${formatPrecio(p.descuento)}`} />
              <Fila k="Subtotal sin IVA" v={formatPrecio(p.subtotal)} />
              {p.envio > 0 && <Fila k="Envío" v={formatPrecio(p.envio)} />}
              <Fila k={`IVA ${p.ivaPct}%`} v={formatPrecio(p.iva)} />
              <div className="border-t border-negro/10 pt-1 font-semibold">
                <Fila k="Total" v={formatPrecio(p.total)} />
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <Modal
        open={accion !== null}
        onClose={() => setAccion(null)}
        title={accion ? titulos[accion] : ''}
        size="sm"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setAccion(null)}>
              Volver
            </Btn>
            <Btn
              variant={accion === 'cancelar' ? 'danger' : 'primary'}
              onClick={ejecutar}
              loading={enviando}
              disabled={accion === 'cancelar' && motivo.trim().length < 3}
              data-testid="mayorista-confirmar"
            >
              Confirmar
            </Btn>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          {accion === 'aprobar' && <p>Se reservan {p.unidades} unidades del stock (el mismo de la tienda). Si no alcanza, te avisamos qué falta.</p>}
          {accion === 'despachar' && (
            <>
              <p>Se descuenta el stock reservado.</p>
              <Field label="Número de seguimiento (opcional)">
                <Input value={seguimiento} onChange={(ev) => setSeguimiento(ev.target.value)} />
              </Field>
            </>
          )}
          {accion === 'entregar' && <p>La óptica recibió el pedido.</p>}
          {accion === 'cancelar' && (
            <Field label="Motivo" required hint="Lo ve la óptica en su portal.">
              <Textarea rows={3} value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
            </Field>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-carey/10 px-3 py-2 text-carey">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
