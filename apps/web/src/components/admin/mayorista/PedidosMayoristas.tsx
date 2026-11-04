'use client';
// Backoffice: pedidos mayoristas de las ópticas (B2B 2 + 3). Aprobar reserva el stock (el mismo de la
// tienda), cancelar lo libera; despachar (o listo para retirar) lo descuenta, numera el remito y genera el
// débito en la cuenta corriente de la óptica. Línea de tiempo, notas internas, factura y devoluciones.
import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@vedere/ui';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { formatFecha, formatPrecio } from '@/lib/format';
import type { DevolucionMayorista, EstadoPedidoMayorista, PedidoMayorista } from '@/lib/mayorista';
import { ENTREGA_LABEL, ESTADO_DEVOLUCION, ESTADO_MAYORISTA, ESTADO_PAGO, numeroRemito } from '@/lib/mayorista';
import type { Paged } from '@/components/admin/table';
import { FilterSelect, Pagination, SearchInput, Table, Td, Th, Toolbar, Tr, useQueryParams } from '@/components/admin/table';
import { Badge, Btn, Card, Checkbox, EmptyState, Field, Input, LinkBtn, Modal, PageHeader, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';

const linkBtn = 'inline-flex h-10 items-center rounded-lg border border-negro/20 bg-blanco px-4 text-sm font-medium hover:bg-gris-claro';

function FechaFiltro({ param, label }: { param: string; label: string }) {
  const { get, set } = useQueryParams();
  return (
    <label className="flex items-center gap-2 text-sm text-gris-medio">
      {label}
      <Input type="date" value={get(param)} onChange={(e) => set({ [param]: e.target.value || undefined })} className="h-10 w-40" aria-label={label} />
    </label>
  );
}

export function PedidosMayoristasTable({
  data,
  opticas,
}: {
  data: Paged<PedidoMayorista> & { resumen: Partial<Record<string, number>> };
  opticas: Array<{ id: string; nombre: string }>;
}) {
  const { searchParams } = useQueryParams();
  const csvParams = new URLSearchParams(searchParams.toString());
  csvParams.delete('page');
  const csv = `/api/admin/mayorista/pedidos.csv${csvParams.toString() ? `?${csvParams}` : ''}`;
  return (
    <>
      <PageHeader
        title="Pedidos mayoristas"
        description="Compras de las ópticas socias. Aprobar reserva el stock; despachar lo descuenta y lo debita en la cuenta corriente."
        actions={
          <>
            <LinkBtn href="/admin/pedidos-mayoristas/devoluciones" variant="secondary">
              Devoluciones
            </LinkBtn>
            <LinkBtn href="/admin/cuentas" variant="secondary">
              Cuentas corrientes
            </LinkBtn>
            <a href={csv} className={linkBtn} data-testid="exportar-csv">
              Exportar CSV
            </a>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(ESTADO_MAYORISTA).map(([k, e]) => (
          <Badge key={k} tone={e.tone}>
            {e.label}: {data.resumen[k] ?? 0}
          </Badge>
        ))}
      </div>
      <Toolbar>
        <SearchInput placeholder="Número, óptica, email o factura…" />
        <FilterSelect param="estado" label="Estado" options={Object.entries(ESTADO_MAYORISTA).map(([value, e]) => ({ value, label: e.label }))} />
        <FilterSelect param="opticaId" label="Óptica" allLabel="Todas" options={opticas.map((o) => ({ value: o.id, label: o.nombre }))} />
        <FilterSelect param="entrega" label="Entrega" options={Object.entries(ENTREGA_LABEL).map(([value, label]) => ({ value, label }))} />
        <FechaFiltro param="desde" label="Desde" />
        <FechaFiltro param="hasta" label="Hasta" />
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
              <Th>Pago</Th>
              <Th align="right">Unidades</Th>
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <Link href={`/admin/pedidos-mayoristas/${p.id}`} className="font-medium hover:underline">
                    {p.numero}
                  </Link>
                  <span className="block text-xs text-gris-medio">{ENTREGA_LABEL[p.entrega]}</span>
                </Td>
                <Td>
                  {p.optica.nombre}
                  <span className="block text-xs text-gris-medio">{p.usuarioEmail}</span>
                </Td>
                <Td>{formatFecha(p.createdAt, true)}</Td>
                <Td>
                  <Badge tone={ESTADO_MAYORISTA[p.estado].tone}>{ESTADO_MAYORISTA[p.estado].label}</Badge>
                </Td>
                <Td>
                  {p.estadoPago === 'NO_APLICA' ? (
                    <span className="text-gris-medio">—</span>
                  ) : (
                    <>
                      <Badge tone={p.vencido ? 'danger' : ESTADO_PAGO[p.estadoPago].tone}>{p.vencido ? 'Vencido' : ESTADO_PAGO[p.estadoPago].label}</Badge>
                      {p.venceEn && <span className="block text-xs text-gris-medio">vence {formatFecha(p.venceEn)}</span>}
                    </>
                  )}
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

type Accion = 'aprobar' | 'preparar' | 'despachar' | 'listo-para-retiro' | 'entregar' | 'cancelar';

const ACCIONES: Record<Accion, { label: string; titulo: string; texto: string }> = {
  aprobar: { label: 'Aprobar y reservar stock', titulo: 'Aprobar', texto: 'Se reserva el stock (el mismo de la tienda). Si no alcanza, te avisamos qué falta.' },
  preparar: { label: 'Pasar a preparación', titulo: 'En preparación', texto: 'La óptica recibe un aviso de que estás armando el pedido.' },
  despachar: {
    label: 'Despachar',
    titulo: 'Despachar',
    texto: 'Se descuenta el stock, se numera el remito y se debita el total en la cuenta corriente de la óptica.',
  },
  'listo-para-retiro': {
    label: 'Listo para retirar',
    titulo: 'Listo para retirar',
    texto: 'Se descuenta el stock, se numera el remito, se debita el total en la cuenta corriente y se le avisa a la óptica que pase a retirarlo.',
  },
  entregar: { label: 'Marcar entregado', titulo: 'Entregado', texto: 'La óptica recibió el pedido.' },
  cancelar: { label: 'Cancelar', titulo: 'Cancelar', texto: 'Se libera el stock reservado.' },
};

function accionesDe(p: PedidoMayorista): Accion[] {
  const salida: Accion = p.entrega === 'RETIRO_DEPOSITO' ? 'listo-para-retiro' : 'despachar';
  const porEstado: Record<EstadoPedidoMayorista, Accion[]> = {
    PENDIENTE_APROBACION: ['aprobar', 'cancelar'],
    EN_REVISION: ['aprobar', 'cancelar'],
    APROBADO: ['preparar', salida, 'cancelar'],
    EN_PREPARACION: [salida, 'cancelar'],
    LISTO_PARA_RETIRO: ['entregar'],
    DESPACHADO: ['entregar'],
    ENTREGADO: [],
    CANCELADO: [],
  };
  return porEstado[p.estado];
}

export function PedidoMayoristaAdmin({ inicial }: { inicial: PedidoMayorista }) {
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState(inicial);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [form, setForm] = useState({ nota: '', motivo: '', transporte: '', numeroSeguimiento: '', linkSeguimiento: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});

  function abrir(a: Accion) {
    setAccion(a);
    setError(null);
    setErrores({});
    setForm({ nota: '', motivo: '', transporte: p.transporte ?? '', numeroSeguimiento: p.numeroSeguimiento ?? '', linkSeguimiento: p.linkSeguimiento ?? '' });
  }

  async function ejecutar() {
    if (!accion) return;
    setEnviando(true);
    setError(null);
    setErrores({});
    try {
      const body =
        accion === 'cancelar'
          ? { motivo: form.motivo }
          : accion === 'despachar'
            ? { transporte: form.transporte, numeroSeguimiento: form.numeroSeguimiento || null, linkSeguimiento: form.linkSeguimiento || null, nota: form.nota || null }
            : { nota: form.nota || null };
      const r = await api.post<PedidoMayorista>(`/admin/mayorista/pedidos/${p.id}/${accion}`, body);
      setP(r);
      setAccion(null);
      toast.ok(`Pedido ${ESTADO_MAYORISTA[r.estado].label.toLowerCase()}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrores(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  const e = ESTADO_MAYORISTA[p.estado];
  const conRemito = !['PENDIENTE_APROBACION', 'EN_REVISION', 'CANCELADO'].includes(p.estado);
  return (
    <>
      <nav className="mb-4 text-sm text-gris-medio">
        <Link href="/admin/pedidos-mayoristas" className="hover:underline">
          Pedidos mayoristas
        </Link>{' '}
        / <span className="text-negro">{p.numero}</span>
      </nav>
      <PageHeader
        title={`Pedido ${p.numero}`}
        description={`${p.optica.nombre} · ${formatFecha(p.createdAt, true)} · ${p.usuarioNombre} (${p.usuarioEmail})`}
        actions={
          <>
            {accionesDe(p).map((a) => (
              <Btn
                key={a}
                variant={a === 'cancelar' ? 'danger' : 'primary'}
                onClick={() => abrir(a)}
                data-testid={a === 'aprobar' ? 'mayorista-aprobar' : `mayorista-${a}`}
              >
                {ACCIONES[a].label}
              </Btn>
            ))}
            {conRemito && (
              <>
                <LinkBtn href={`/admin/pedidos-mayoristas/${p.id}/picking`} variant="secondary">
                  Lista de picking
                </LinkBtn>
                <a href={`/api/admin/mayorista/pedidos/${p.id}/remito.pdf`} target="_blank" rel="noopener" className={linkBtn} data-testid="remito-pdf">
                  Remito PDF
                </a>
              </>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Ítems (precios congelados, sin IVA)">
            <ItemsTabla p={p} />
          </Card>
          {(p.devoluciones?.length ?? 0) > 0 && (
            <Card title="Devoluciones">
              <div className="space-y-4">
                {p.devoluciones!.map((d) => (
                  <DevolucionAdmin key={d.id} d={d} onCambio={(np) => (np ? setP(np) : router.refresh())} pedidoId={p.id} />
                ))}
              </div>
            </Card>
          )}
          <Card title="Línea de tiempo">
            <LineaDeTiempo p={p} />
            <NotaForm pedidoId={p.id} onGuardado={setP} />
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Estado">
            <Badge tone={e.tone}>{e.label}</Badge>
            {p.motivoRevision && (p.estado === 'EN_REVISION' || p.estado === 'PENDIENTE_APROBACION') && (
              <p className="mt-2 rounded-lg bg-[#b7791f]/10 px-3 py-2 text-sm text-[#8a5a12]" data-testid="motivo-revision">
                {p.motivoRevision}
              </p>
            )}
            {p.motivoCancelacion && <p className="mt-2 text-sm text-carey">Motivo: {p.motivoCancelacion}</p>}
            {p.numeroRemito && <p className="mt-2 text-sm">Remito {numeroRemito(p.numeroRemito)}</p>}
          </Card>
          <Card
            title="Cuenta corriente"
            actions={
              <Link href={`/admin/cuentas/${p.optica.id}`} className="text-xs underline underline-offset-2">
                Ver cuenta
              </Link>
            }
          >
            {p.estadoPago === 'NO_APLICA' ? (
              <p className="text-sm text-gris-medio">Se debita al despachar (plazo {p.plazoPagoDias ?? '—'} días).</p>
            ) : (
              <dl className="space-y-1 text-sm" data-testid="pago-pedido">
                <Fila k="Estado" v={<Badge tone={p.vencido ? 'danger' : ESTADO_PAGO[p.estadoPago].tone}>{p.vencido ? 'Vencido' : ESTADO_PAGO[p.estadoPago].label}</Badge>} />
                <Fila k="Vence" v={formatFecha(p.venceEn)} />
                <Fila k="Pagado" v={formatPrecio(p.pagado)} />
                <Fila k="Pendiente" v={formatPrecio(p.pendiente)} />
              </dl>
            )}
          </Card>
          <Card title="Entrega">
            <p className="text-sm font-medium">{ENTREGA_LABEL[p.entrega]}</p>
            <p className="text-sm text-gris-medio">{p.direccionEntrega}</p>
            {p.envioACargoOptica && <p className="mt-1 text-xs">Flete a cargo de la óptica.</p>}
            {p.transporte && (
              <p className="mt-2 text-sm">
                {p.transporte}
                {p.numeroSeguimiento && ` · guía ${p.numeroSeguimiento}`}
                {p.linkSeguimiento && (
                  <a href={p.linkSeguimiento} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
                    seguimiento
                  </a>
                )}
              </p>
            )}
            {p.notas && <p className="mt-2 text-sm">Notas de la óptica: {p.notas}</p>}
          </Card>
          <DatosInternos p={p} onGuardado={setP} />
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
        title={accion ? `${ACCIONES[accion].titulo} ${p.numero}` : ''}
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
              disabled={(accion === 'cancelar' && form.motivo.trim().length < 3) || (accion === 'despachar' && form.transporte.trim().length < 2)}
              data-testid="mayorista-confirmar"
            >
              Confirmar
            </Btn>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          {accion && <p>{accion === 'aprobar' ? `Se reservan ${p.unidades} unidades del stock (el mismo de la tienda). Si no alcanza, te avisamos qué falta.` : ACCIONES[accion].texto}</p>}
          {accion === 'despachar' && (
            <>
              <Field label="Transporte" required error={errores.transporte}>
                <Input value={form.transporte} onChange={(ev) => setForm({ ...form, transporte: ev.target.value })} placeholder="Vía Cargo, Andreani, Expreso…" data-testid="despacho-transporte" />
              </Field>
              <Field label="Número de guía" error={errores.numeroSeguimiento}>
                <Input value={form.numeroSeguimiento} onChange={(ev) => setForm({ ...form, numeroSeguimiento: ev.target.value })} />
              </Field>
              <Field label="Link de seguimiento" error={errores.linkSeguimiento}>
                <Input value={form.linkSeguimiento} onChange={(ev) => setForm({ ...form, linkSeguimiento: ev.target.value })} placeholder="https://…" inputMode="url" />
              </Field>
            </>
          )}
          {accion === 'cancelar' ? (
            <Field label="Motivo" required hint="Lo ve la óptica en su portal.">
              <Textarea rows={3} value={form.motivo} onChange={(ev) => setForm({ ...form, motivo: ev.target.value })} />
            </Field>
          ) : (
            accion && (
              <Field label="Nota (opcional)" hint="Queda en la línea de tiempo y la ve la óptica.">
                <Textarea rows={2} value={form.nota} onChange={(ev) => setForm({ ...form, nota: ev.target.value })} />
              </Field>
            )
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

export function ItemsTabla({ p }: { p: PedidoMayorista }) {
  return (
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
  );
}

export function LineaDeTiempo({ p }: { p: PedidoMayorista }) {
  const eventos = p.eventos ?? [];
  if (!eventos.length) return <p className="text-sm text-gris-medio">Sin movimientos todavía.</p>;
  return (
    <ol className="space-y-3" data-testid="linea-tiempo">
      {[...eventos].reverse().map((ev) => (
        <li key={ev.id} className="relative border-l-2 border-negro/10 pl-4">
          <span className={cn('absolute -left-[5px] top-1.5 h-2 w-2 rounded-full', ev.estado ? 'bg-negro' : 'bg-negro/30')} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {ev.estado ? <Badge tone={ESTADO_MAYORISTA[ev.estado].tone}>{ESTADO_MAYORISTA[ev.estado].label}</Badge> : <span className="font-medium">{TIPO_EVENTO[ev.tipo] ?? ev.tipo}</span>}
            {ev.interno && <Badge tone="neutral">Interno</Badge>}
            <span className="text-xs text-gris-medio">
              {formatFecha(ev.createdAt, true)} · {ev.usuarioNombre ?? 'Sistema'}
            </span>
          </div>
          {ev.nota && <p className="mt-0.5 whitespace-pre-line text-sm text-negro/80">{ev.nota}</p>}
        </li>
      ))}
    </ol>
  );
}

const TIPO_EVENTO: Record<string, string> = {
  NOTA: 'Nota',
  NOTA_INTERNA: 'Notas internas',
  FACTURA: 'Factura',
  PAGO: 'Pago',
  DEVOLUCION: 'Devolución',
  EMAIL: 'Email',
};

function NotaForm({ pedidoId, onGuardado }: { pedidoId: string; onGuardado: (p: PedidoMayorista) => void }) {
  const toast = useToast();
  const [nota, setNota] = useState('');
  const [visible, setVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  async function guardar() {
    setGuardando(true);
    try {
      onGuardado(await api.patch<PedidoMayorista>(`/admin/mayorista/pedidos/${pedidoId}`, { nota, notaInterna: !visible }));
      setNota('');
      toast.ok('Nota agregada');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setGuardando(false);
    }
  }
  return (
    <div className="mt-5 space-y-2 border-t border-negro/10 pt-4">
      <Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Agregar una nota a la línea de tiempo…" aria-label="Nota" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Checkbox label="Visible para la óptica" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
        <Btn size="sm" onClick={guardar} loading={guardando} disabled={!nota.trim()}>
          Agregar nota
        </Btn>
      </div>
    </div>
  );
}

function DatosInternos({ p, onGuardado }: { p: PedidoMayorista; onGuardado: (p: PedidoMayorista) => void }) {
  const toast = useToast();
  const [factura, setFactura] = useState(p.numeroFactura ?? '');
  const [notas, setNotas] = useState(p.notasInternas ?? '');
  const [guardando, setGuardando] = useState(false);
  const cambio = factura !== (p.numeroFactura ?? '') || notas !== (p.notasInternas ?? '');
  async function guardar() {
    setGuardando(true);
    try {
      const r = await api.patch<PedidoMayorista>(`/admin/mayorista/pedidos/${p.id}`, { numeroFactura: factura.trim() || null, notasInternas: notas.trim() || null });
      onGuardado(r);
      toast.ok('Datos guardados');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setGuardando(false);
    }
  }
  return (
    <Card title="Facturación y notas internas">
      <div className="space-y-3">
        <Field label="Número de factura" hint="La óptica lo ve en su portal y recibe un aviso.">
          <Input value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="A-0001-00001234" data-testid="numero-factura" />
        </Field>
        <Field label="Notas internas" hint="Sólo las ve el equipo de Vedere.">
          <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} data-testid="notas-internas" />
        </Field>
        <Btn size="sm" onClick={guardar} loading={guardando} disabled={!cambio}>
          Guardar
        </Btn>
      </div>
    </Card>
  );
}

export function DevolucionAdmin({
  d,
  pedidoId,
  onCambio,
  conPedido,
}: {
  d: DevolucionMayorista;
  pedidoId: string;
  onCambio: (p?: PedidoMayorista) => void;
  conPedido?: boolean;
}) {
  const toast = useToast();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function resolver(accion: 'aprobar' | 'rechazar') {
    setEnviando(true);
    try {
      await api.post(`/admin/mayorista/devoluciones/${d.id}/${accion}`, accion === 'rechazar' ? { motivo } : {});
      toast.ok(accion === 'aprobar' ? 'Devolución aprobada: stock reingresado y nota de crédito emitida' : 'Devolución rechazada');
      setRechazando(false);
      onCambio(conPedido ? undefined : await api.get<PedidoMayorista>(`/admin/mayorista/pedidos/${pedidoId}`));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }
  const est = ESTADO_DEVOLUCION[d.estado];
  return (
    <div className="rounded-lg border border-negro/10 p-4" data-testid="devolucion">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={est.tone}>{est.label}</Badge>
        {conPedido && d.pedido && (
          <Link href={`/admin/pedidos-mayoristas/${d.pedido.id}`} className="font-medium hover:underline">
            {d.pedido.numero}
          </Link>
        )}
        {d.optica && <span>{d.optica.nombre}</span>}
        <span className="text-xs text-gris-medio">
          {formatFecha(d.createdAt, true)} · {d.usuarioNombre}
        </span>
        <span className="ml-auto font-medium tabular-nums">{formatPrecio(d.importe)} con IVA</span>
      </div>
      <p className="mt-2 text-sm">{d.motivo}</p>
      <ul className="mt-2 text-sm text-gris-medio">
        {d.items.map((i) => (
          <li key={i.id}>
            {i.cantidad} × {i.nombre} {i.color} <span className="font-mono text-xs">{i.sku}</span>
          </li>
        ))}
      </ul>
      {d.fotos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {d.fotos.map((f) => (
            <a key={f} href={f} target="_blank" rel="noopener noreferrer" className="block h-16 w-16 overflow-hidden rounded-md border border-negro/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f} alt="Foto de la devolución" className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {d.motivoRechazo && <p className="mt-2 text-sm text-carey">Rechazada: {d.motivoRechazo}</p>}
      {d.estado === 'SOLICITADA' &&
        (rechazando ? (
          <div className="mt-3 space-y-2">
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del rechazo (lo ve la óptica)" aria-label="Motivo del rechazo" />
            <div className="flex gap-2">
              <Btn size="sm" variant="danger" onClick={() => resolver('rechazar')} loading={enviando} disabled={motivo.trim().length < 3}>
                Rechazar
              </Btn>
              <Btn size="sm" variant="secondary" onClick={() => setRechazando(false)}>
                Volver
              </Btn>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <Btn size="sm" onClick={() => resolver('aprobar')} loading={enviando} data-testid="devolucion-aprobar">
              Aprobar: reingresar stock y emitir nota de crédito
            </Btn>
            <Btn size="sm" variant="secondary" onClick={() => setRechazando(true)}>
              Rechazar
            </Btn>
          </div>
        ))}
    </div>
  );
}

export function DevolucionesMayoristas({ data }: { data: Paged<DevolucionMayorista> & { resumen: Partial<Record<string, number>> } }) {
  const router = useRouter();
  return (
    <>
      <nav className="mb-4 text-sm text-gris-medio">
        <Link href="/admin/pedidos-mayoristas" className="hover:underline">
          Pedidos mayoristas
        </Link>{' '}
        / <span className="text-negro">Devoluciones</span>
      </nav>
      <PageHeader title="Devoluciones mayoristas" description="Al aprobar una devolución se reingresa el stock y se emite una nota de crédito en la cuenta de la óptica." />
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(ESTADO_DEVOLUCION).map(([k, e]) => (
          <Badge key={k} tone={e.tone}>
            {e.label}: {data.resumen[k] ?? 0}
          </Badge>
        ))}
      </div>
      <Toolbar>
        <FilterSelect param="estado" label="Estado" options={Object.entries(ESTADO_DEVOLUCION).map(([value, e]) => ({ value, label: e.label }))} />
      </Toolbar>
      {data.items.length === 0 ? (
        <EmptyState title="No hay devoluciones" description="Las ópticas las piden desde el detalle de cada compra." />
      ) : (
        <div className="space-y-3">
          {data.items.map((d) => (
            <DevolucionAdmin key={d.id} d={d} pedidoId={d.pedidoId} conPedido onCambio={() => router.refresh()} />
          ))}
        </div>
      )}
      <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} />
    </>
  );
}

/** Lista de picking imprimible: ítems por SKU con casillero para tildar. */
export function PickingList({ p }: { p: PedidoMayorista }) {
  const items = [...p.items].sort((a, b) => a.sku.localeCompare(b.sku));
  return (
    <div className="mx-auto max-w-3xl bg-blanco p-6 print:p-0">
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <Link href={`/admin/pedidos-mayoristas/${p.id}`} className="text-sm underline underline-offset-2">
          Volver al pedido
        </Link>
        <Btn onClick={() => window.print()}>Imprimir</Btn>
      </div>
      <header className="mb-4 border-b border-negro pb-3">
        <p className="text-xs uppercase tracking-widest text-gris-medio">Vedere · Lista de picking</p>
        <h1 className="text-2xl font-bold">{p.numero}</h1>
        <p className="text-sm">
          {p.optica.nombre} · {ENTREGA_LABEL[p.entrega]} · {p.direccionEntrega}
        </p>
        <p className="text-sm text-gris-medio">
          Confirmado {formatFecha(p.createdAt, true)} · {p.unidades} unidades{p.numeroRemito ? ` · Remito ${numeroRemito(p.numeroRemito)}` : ''}
        </p>
      </header>
      <table className="w-full text-sm" data-testid="picking">
        <thead className="border-b border-negro/30 text-left text-xs uppercase tracking-wide">
          <tr>
            <th className="w-10 py-2">✓</th>
            <th className="py-2">SKU</th>
            <th className="py-2">Modelo</th>
            <th className="py-2">Color</th>
            <th className="py-2 text-right">Cant.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-negro/10">
          {items.map((i) => (
            <tr key={i.id}>
              <td className="py-2.5">
                <span className="inline-block h-4 w-4 rounded-sm border border-negro" />
              </td>
              <td className="py-2.5 font-mono">{i.sku}</td>
              <td className="py-2.5">{i.nombre}</td>
              <td className="py-2.5">{i.color}</td>
              <td className="py-2.5 text-right text-base font-semibold tabular-nums">{i.cantidad}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {p.notas && (
        <p className="mt-4 rounded-lg border border-negro/20 p-3 text-sm">
          <strong>Notas de la óptica:</strong> {p.notas}
        </p>
      )}
      {p.notasInternas && (
        <p className="mt-2 rounded-lg border border-negro/20 p-3 text-sm">
          <strong>Notas internas:</strong> {p.notasInternas}
        </p>
      )}
      <div className="mt-10 grid grid-cols-2 gap-10 text-xs text-gris-medio">
        <p className="border-t border-negro/40 pt-1">Armó</p>
        <p className="border-t border-negro/40 pt-1">Controló</p>
      </div>
    </div>
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
