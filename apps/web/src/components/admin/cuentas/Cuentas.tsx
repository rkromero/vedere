'use client';
// B2B 3: cuentas corrientes de las ópticas en el backoffice. Listado con saldo y deuda vencida, pagos
// informados por las ópticas (validar / rechazar), detalle con movimientos, registro de pagos con
// imputación a pedidos, ajustes con motivo (sólo ADMIN) y estado de cuenta en PDF.
import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@vedere/ui';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { formatFecha, formatPrecio } from '@/lib/format';
import type { CuentaListado, MedioPago, MovimientosPaginados, PagoInformado, PedidoConDeuda, ResumenCuenta } from '@/lib/mayorista';
import { MEDIO_PAGO } from '@/lib/mayorista';
import type { Paged } from '@/components/admin/table';
import { Pagination, Table, Td, Th, Tr } from '@/components/admin/table';
import { Btn, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';

const linkBtn = 'inline-flex h-10 items-center rounded-lg border border-negro/20 bg-blanco px-4 text-sm font-medium hover:bg-gris-claro';
const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.')) || 0;
const hoyIso = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export function Dato({ label, valor, tono, testid }: { label: string; valor: ReactNode; tono?: 'danger' | 'ok'; testid?: string }) {
  return (
    <div className="rounded-xl border border-negro/10 bg-blanco p-4" data-testid={testid}>
      <p className="text-xs uppercase tracking-wide text-gris-medio">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', tono === 'danger' && 'text-carey', tono === 'ok' && 'text-[#2f7d4f]')}>{valor}</p>
    </div>
  );
}

export function CuentasListado({
  items,
  totales,
  pagos,
}: {
  items: CuentaListado[];
  totales: { deudaTotal: number; deudaVencida: number; opticasConDeudaVencida: number };
  pagos: Paged<PagoInformado> & { pendientes: number };
}) {
  const conMovimiento = items.filter((i) => i.saldo !== 0 || i.limiteCredito > 0);
  return (
    <>
      <PageHeader title="Cuentas corrientes" description="Saldo de cada óptica (suma de sus movimientos), crédito y deuda vencida." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Dato label="Deuda total" valor={formatPrecio(totales.deudaTotal)} />
        <Dato label="Deuda vencida" valor={formatPrecio(totales.deudaVencida)} tono={totales.deudaVencida > 0 ? 'danger' : undefined} />
        <Dato label="Ópticas con deuda vencida" valor={totales.opticasConDeudaVencida} />
      </div>
      <PagosInformadosAdmin pagos={pagos} />
      {conMovimiento.length === 0 ? (
        <EmptyState title="Todavía no hay cuentas con movimientos" description="Asigná un límite de crédito a cada óptica desde Ópticas." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Óptica</Th>
              <Th align="right">Límite</Th>
              <Th align="right">Plazo</Th>
              <Th align="right">Saldo</Th>
              <Th align="right">Deuda vencida</Th>
            </tr>
          </thead>
          <tbody>
            {conMovimiento.map((c) => (
              <Tr key={c.optica.id}>
                <Td>
                  <Link href={`/admin/cuentas/${c.optica.id}`} className="font-medium hover:underline">
                    {c.optica.nombre}
                  </Link>
                  {!c.optica.activa && <span className="ml-2 text-xs text-gris-medio">(pausada)</span>}
                </Td>
                <Td align="right">{formatPrecio(c.limiteCredito)}</Td>
                <Td align="right">{c.plazoPagoDias} días</Td>
                <Td align="right" className="font-medium">
                  {formatPrecio(c.saldo)}
                </Td>
                <Td align="right" className={c.deudaVencida > 0 ? 'font-medium text-carey' : 'text-gris-medio'}>
                  {formatPrecio(c.deudaVencida)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

function PagosInformadosAdmin({ pagos }: { pagos: Paged<PagoInformado> & { pendientes: number } }) {
  const router = useRouter();
  const toast = useToast();
  const [rechazo, setRechazo] = useState<PagoInformado | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState<string | null>(null);
  async function validar(p: PagoInformado) {
    setEnviando(p.id);
    try {
      await api.post(`/admin/cuentas/pagos-informados/${p.id}/validar`, {});
      toast.ok('Pago validado e imputado');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setEnviando(null);
    }
  }
  async function rechazar() {
    if (!rechazo) return;
    setEnviando(rechazo.id);
    try {
      await api.post(`/admin/cuentas/pagos-informados/${rechazo.id}/rechazar`, { motivo });
      toast.ok('Pago rechazado');
      setRechazo(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setEnviando(null);
    }
  }
  const pendientes = pagos.items.filter((p) => p.estado === 'PENDIENTE');
  if (!pendientes.length) return null;
  return (
    <Card title={`Pagos informados por las ópticas (${pagos.pendientes} para validar)`} className="mb-6">
      <div className="divide-y divide-negro/5" data-testid="pagos-informados">
        {pendientes.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {p.optica.nombre} · {formatPrecio(p.importe)} por {MEDIO_PAGO[p.medio].toLowerCase()}
              </p>
              <p className="text-xs text-gris-medio">
                Pagó el {formatFecha(p.fechaPago)} · informado por {p.usuarioNombre} el {formatFecha(p.createdAt, true)}
                {p.referencia && ` · ref. ${p.referencia}`}
              </p>
              {p.notas && <p className="text-xs">{p.notas}</p>}
            </div>
            <a href={p.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-2">
              Ver comprobante
            </a>
            <Btn size="sm" onClick={() => validar(p)} loading={enviando === p.id} data-testid="validar-pago">
              Validar e imputar
            </Btn>
            <Btn size="sm" variant="secondary" onClick={() => (setRechazo(p), setMotivo(''))}>
              Rechazar
            </Btn>
          </div>
        ))}
      </div>
      <Modal
        open={!!rechazo}
        onClose={() => setRechazo(null)}
        title="Rechazar pago informado"
        size="sm"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setRechazo(null)}>
              Volver
            </Btn>
            <Btn variant="danger" onClick={rechazar} loading={!!enviando} disabled={motivo.trim().length < 3}>
              Rechazar
            </Btn>
          </>
        }
      >
        <Field label="Motivo" required hint="Le llega por email a la óptica.">
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
      </Modal>
    </Card>
  );
}

export function CuentaOpticaAdmin({
  optica,
  resumen,
  pedidosPendientes,
  movimientos,
  esAdmin,
}: {
  optica: { id: string; nombre: string; cuit: string | null; email: string | null };
  resumen: ResumenCuenta;
  pedidosPendientes: PedidoConDeuda[];
  movimientos: MovimientosPaginados;
  esAdmin: boolean;
}) {
  const [modal, setModal] = useState<'pago' | 'ajuste' | null>(null);
  return (
    <>
      <nav className="mb-4 text-sm text-gris-medio">
        <Link href="/admin/cuentas" className="hover:underline">
          Cuentas corrientes
        </Link>{' '}
        / <span className="text-negro">{optica.nombre}</span>
      </nav>
      <PageHeader
        title={`Cuenta de ${optica.nombre}`}
        description={`Límite ${formatPrecio(resumen.limiteCredito)} · plazo ${resumen.plazoPagoDias} días${optica.cuit ? ` · CUIT ${optica.cuit}` : ''}`}
        actions={
          <>
            <Btn onClick={() => setModal('pago')} data-testid="registrar-pago">
              Registrar pago
            </Btn>
            {esAdmin && (
              <Btn variant="secondary" onClick={() => setModal('ajuste')}>
                Ajuste
              </Btn>
            )}
            <a href={`/api/admin/cuentas/${optica.id}/estado.pdf`} target="_blank" rel="noopener" className={linkBtn}>
              Estado de cuenta PDF
            </a>
          </>
        }
      />
      <ResumenCards resumen={resumen} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card title="Movimientos">
          <MovimientosTabla data={movimientos} />
        </Card>
        <Card title="Pedidos con saldo pendiente">
          <PendientesLista pedidos={pedidosPendientes} href={(id) => `/admin/pedidos-mayoristas/${id}`} />
        </Card>
      </div>
      {modal === 'pago' && <PagoModal opticaId={optica.id} pendientes={pedidosPendientes} onClose={() => setModal(null)} />}
      {modal === 'ajuste' && <AjusteModal opticaId={optica.id} onClose={() => setModal(null)} />}
    </>
  );
}

export function ResumenCards({ resumen: r }: { resumen: ResumenCuenta }) {
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="resumen-cuenta">
      <Dato label={r.saldo < 0 ? 'Saldo a favor' : 'Saldo'} valor={formatPrecio(Math.abs(r.saldo))} tono={r.saldo < 0 ? 'ok' : undefined} testid="saldo" />
      <Dato label="Crédito disponible" valor={formatPrecio(r.disponible)} tono={r.disponible < 0 ? 'danger' : undefined} />
      <Dato label="Deuda vencida" valor={formatPrecio(r.deudaVencida)} tono={r.deudaVencida > 0 ? 'danger' : undefined} />
      <Dato
        label="Próximo vencimiento"
        valor={r.proximosVencimientos[0] ? `${formatFecha(r.proximosVencimientos[0].venceEn)} · ${formatPrecio(r.proximosVencimientos[0].pendiente)}` : '—'}
      />
    </div>
  );
}

export function PendientesLista({ pedidos, href }: { pedidos: PedidoConDeuda[]; href: (id: string) => string }) {
  if (!pedidos.length) return <p className="text-sm text-gris-medio">No hay pedidos con saldo pendiente.</p>;
  const hoy = Date.now();
  return (
    <ul className="divide-y divide-negro/5 text-sm" data-testid="pedidos-pendientes">
      {pedidos.map((p) => {
        const vencido = new Date(p.venceEn).getTime() < hoy;
        return (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2">
            <div>
              <Link href={href(p.id)} className="font-medium hover:underline">
                {p.numero}
              </Link>
              <span className={cn('block text-xs', vencido ? 'text-carey' : 'text-gris-medio')}>
                {vencido ? `Vencido hace ${p.diasVencido} día${p.diasVencido === 1 ? '' : 's'}` : `Vence ${formatFecha(p.venceEn)}`}
              </span>
            </div>
            <div className="text-right tabular-nums">
              <span className="font-medium">{formatPrecio(p.pendiente)}</span>
              {p.pagado > 0 && <span className="block text-xs text-gris-medio">de {formatPrecio(p.total)}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function MovimientosTabla({ data }: { data: MovimientosPaginados }) {
  if (!data.items.length) return <p className="text-sm text-gris-medio">Sin movimientos todavía.</p>;
  return (
    <>
      <div className="-mx-5 -my-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm" data-testid="movimientos">
          <thead className="border-b border-negro/10 text-left text-xs uppercase tracking-wide text-gris-medio">
            <tr>
              <th className="px-5 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Detalle</th>
              <th className="px-3 py-2 text-right font-medium">Debe</th>
              <th className="px-3 py-2 text-right font-medium">Haber</th>
              <th className="px-5 py-2 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-negro/5">
            {data.items.map((m) => (
              <tr key={m.id} className="align-top">
                <td className="whitespace-nowrap px-5 py-2">{formatFecha(m.fecha)}</td>
                <td className="px-3 py-2">
                  <span className="font-medium">{m.tipoLabel}</span> · {m.descripcion}
                  {m.motivo && <span className="block text-xs text-gris-medio">{m.motivo}</span>}
                  {m.vencimiento && <span className="block text-xs text-gris-medio">Vence {formatFecha(m.vencimiento)}</span>}
                  {m.imputaciones.length > 0 && (
                    <span className="block text-xs text-gris-medio">
                      Imputado: {m.imputaciones.map((i) => `${i.numero} ${formatPrecio(i.monto)}`).join(', ')}
                    </span>
                  )}
                  {m.comprobanteUrl && (
                    <a href={m.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="block text-xs underline">
                      Comprobante
                    </a>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{m.importe > 0 ? formatPrecio(m.importe) : ''}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[#2f7d4f]">{m.importe < 0 ? formatPrecio(-m.importe) : ''}</td>
                <td className="px-5 py-2 text-right font-medium tabular-nums">{formatPrecio(m.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-8">
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} />
      </div>
    </>
  );
}

function PagoModal({ opticaId, pendientes, onClose }: { opticaId: string; pendientes: PedidoConDeuda[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ importe: '', medio: 'TRANSFERENCIA' as MedioPago, fecha: hoyIso(), referencia: '', notas: '' });
  const [imput, setImput] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const importe = num(form.importe);
  const imputado = Object.values(imput).reduce((a, v) => a + num(v), 0);

  function repartir() {
    let resto = importe;
    const r: Record<string, string> = {};
    for (const p of pendientes) {
      if (resto <= 0) break;
      const m = Math.min(resto, p.pendiente);
      r[p.id] = String(Math.round(m * 100) / 100);
      resto -= m;
    }
    setImput(r);
  }

  async function guardar() {
    setEnviando(true);
    setError(null);
    setErrores({});
    try {
      await api.post(`/admin/cuentas/${opticaId}/pagos`, {
        importe,
        medio: form.medio,
        fecha: form.fecha || null,
        referencia: form.referencia || null,
        notas: form.notas || null,
        imputaciones: Object.entries(imput)
          .map(([pedidoId, v]) => ({ pedidoId, monto: num(v) }))
          .filter((i) => i.monto > 0),
      });
      toast.ok('Pago registrado');
      onClose();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrores(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar pago"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancelar
          </Btn>
          <Btn onClick={guardar} loading={enviando} disabled={importe <= 0 || imputado > importe + 0.001} data-testid="guardar-pago">
            Registrar
          </Btn>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Importe" required error={errores.importe}>
            <Input value={form.importe} onChange={(e) => setForm({ ...form, importe: e.target.value })} inputMode="decimal" data-testid="pago-importe" />
          </Field>
          <Field label="Medio" required>
            <Select value={form.medio} onChange={(e) => setForm({ ...form, medio: e.target.value as MedioPago })}>
              {Object.entries(MEDIO_PAGO).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha" error={errores.fecha}>
            <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </Field>
        </div>
        <Field label="Referencia" hint="Número de operación, de e-cheq o recibo.">
          <Input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
        </Field>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">Imputar a pedidos</p>
            {pendientes.length > 0 && (
              <button type="button" onClick={repartir} className="text-xs underline underline-offset-2" disabled={importe <= 0}>
                Repartir a los más viejos
              </button>
            )}
          </div>
          {pendientes.length === 0 ? (
            <p className="text-gris-medio">No hay pedidos con saldo: el pago queda a favor de la óptica.</p>
          ) : (
            <ul className="space-y-2">
              {pendientes.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="flex-1">
                    {p.numero} <span className="text-xs text-gris-medio">· pendiente {formatPrecio(p.pendiente)} · vence {formatFecha(p.venceEn)}</span>
                  </span>
                  <Input
                    value={imput[p.id] ?? ''}
                    onChange={(e) => setImput({ ...imput, [p.id]: e.target.value })}
                    inputMode="decimal"
                    className="w-32"
                    aria-label={`Imputar a ${p.numero}`}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className={cn('mt-2 text-xs', imputado > importe + 0.001 ? 'text-carey' : 'text-gris-medio')}>
            Imputado {formatPrecio(imputado)} de {formatPrecio(importe)}. Lo que no imputes se aplica a los pedidos que vencen antes.
          </p>
        </div>
        <Field label="Notas">
          <Textarea rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
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

function AjusteModal({ opticaId, onClose }: { opticaId: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [signo, setSigno] = useState<'credito' | 'debito'>('credito');
  const [importe, setImporte] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function guardar() {
    setEnviando(true);
    setError(null);
    try {
      await api.post(`/admin/cuentas/${opticaId}/ajustes`, { importe: (signo === 'credito' ? -1 : 1) * num(importe), motivo });
      toast.ok('Ajuste registrado');
      onClose();
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Ajuste de cuenta"
      size="sm"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancelar
          </Btn>
          <Btn onClick={guardar} loading={enviando} disabled={num(importe) <= 0 || motivo.trim().length < 5}>
            Registrar ajuste
          </Btn>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <Field label="Tipo">
          <Select value={signo} onChange={(e) => setSigno(e.target.value as 'credito' | 'debito')}>
            <option value="credito">Crédito (baja la deuda)</option>
            <option value="debito">Débito (sube la deuda)</option>
          </Select>
        </Field>
        <Field label="Importe" required>
          <Input value={importe} onChange={(e) => setImporte(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Motivo" required hint="Obligatorio: queda en el estado de cuenta.">
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
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
