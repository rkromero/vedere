'use client';
// B2B 3: cuenta corriente de la óptica en su portal. Sólo lectura de movimientos; puede informar un pago
// subiendo el comprobante (queda pendiente hasta que Vedere lo valida) y descargar el estado de cuenta.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { formatFecha, formatPrecio } from '@/lib/format';
import type { MedioPago, MovimientosPaginados, PagoInformado, PedidoConDeuda, ResumenCuenta } from '@/lib/mayorista';
import { ESTADO_PAGO_INFORMADO, MEDIO_PAGO } from '@/lib/mayorista';
import type { Paged } from '@/components/admin/table';
import { MovimientosTabla, PendientesLista, ResumenCards } from '@/components/admin/cuentas/Cuentas';
import { Badge, Btn, Card, Checkbox, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';

const linkBtn = 'inline-flex h-10 items-center rounded-lg border border-negro/20 bg-blanco px-4 text-sm font-medium hover:bg-gris-claro';
const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.')) || 0;
const hoyIso = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export function CuentaOptica({
  resumen,
  pedidosPendientes,
  movimientos,
  pagos,
}: {
  resumen: ResumenCuenta;
  pedidosPendientes: PedidoConDeuda[];
  movimientos: MovimientosPaginados;
  pagos: Paged<PagoInformado>;
}) {
  const [informar, setInformar] = useState(false);
  return (
    <>
      <PageHeader
        title="Cuenta corriente"
        description={`Tu crédito con Vedere: ${formatPrecio(resumen.limiteCredito)} a ${resumen.plazoPagoDias} días desde el despacho.`}
        actions={
          <>
            <Btn onClick={() => setInformar(true)} data-testid="informar-pago">
              Informar un pago
            </Btn>
            <a href="/api/optica/cuenta/estado.pdf" target="_blank" rel="noopener" className={linkBtn} data-testid="estado-cuenta-pdf">
              Estado de cuenta PDF
            </a>
          </>
        }
      />
      {resumen.deudaVencida > 0 && (
        <p role="alert" className="mb-4 rounded-lg bg-carey/10 px-4 py-3 text-sm text-carey">
          Tenés {formatPrecio(resumen.deudaVencida)} vencidos. Con deuda vencida de más de {resumen.diasTolerancia} días, los pedidos nuevos quedan en revisión.
        </p>
      )}
      <ResumenCards resumen={resumen} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card title="Movimientos">
          <MovimientosTabla data={movimientos} />
        </Card>
        <div className="space-y-4">
          <Card title="Vencimientos">
            <PendientesLista pedidos={pedidosPendientes} href={(id) => `/optica/compras/${id}`} />
          </Card>
          <Card title="Pagos informados">
            {pagos.items.length === 0 ? (
              <p className="text-sm text-gris-medio">Cuando pagues, informalo con el comprobante así lo imputamos más rápido.</p>
            ) : (
              <ul className="divide-y divide-negro/5 text-sm" data-testid="mis-pagos-informados">
                {pagos.items.map((p) => (
                  <li key={p.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium tabular-nums">{formatPrecio(p.importe)}</span>
                      <Badge tone={ESTADO_PAGO_INFORMADO[p.estado].tone}>{ESTADO_PAGO_INFORMADO[p.estado].label}</Badge>
                    </div>
                    <p className="text-xs text-gris-medio">
                      {MEDIO_PAGO[p.medio]} del {formatFecha(p.fechaPago)}
                      {p.referencia && ` · ${p.referencia}`}
                    </p>
                    {p.motivoRechazo && <p className="text-xs text-carey">{p.motivoRechazo}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      {informar && <InformarPago pendientes={pedidosPendientes} onClose={() => setInformar(false)} />}
    </>
  );
}

function InformarPago({ pendientes, onClose }: { pendientes: PedidoConDeuda[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ importe: '', medio: 'TRANSFERENCIA' as MedioPago, fechaPago: hoyIso(), referencia: '', notas: '' });
  const [pedidos, setPedidos] = useState<string[]>([]);
  const [comprobante, setComprobante] = useState<{ url: string; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});

  async function subir(file: File) {
    setSubiendo(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post<{ url: string; nombre: string }>('/optica/cuenta/comprobante', fd);
      setComprobante(r);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubiendo(false);
    }
  }

  async function enviar() {
    if (!comprobante) return;
    setEnviando(true);
    setError(null);
    setErrores({});
    try {
      await api.post('/optica/cuenta/pagos-informados', {
        importe: num(form.importe),
        medio: form.medio,
        fechaPago: form.fechaPago,
        referencia: form.referencia || null,
        notas: form.notas || null,
        comprobanteUrl: comprobante.url,
        comprobanteNombre: comprobante.nombre,
        pedidoIds: pedidos,
      });
      toast.ok('Recibimos tu pago: lo validamos y te avisamos');
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
      title="Informar un pago"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancelar
          </Btn>
          <Btn onClick={enviar} loading={enviando} disabled={!comprobante || num(form.importe) <= 0} data-testid="enviar-pago">
            Informar pago
          </Btn>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-gris-medio">El pago impacta en tu cuenta cuando lo validamos. Te llega un email con la confirmación.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Importe" required error={errores.importe}>
            <Input value={form.importe} onChange={(e) => setForm({ ...form, importe: e.target.value })} inputMode="decimal" data-testid="informar-importe" />
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
          <Field label="Fecha del pago" required error={errores.fechaPago}>
            <Input type="date" value={form.fechaPago} onChange={(e) => setForm({ ...form, fechaPago: e.target.value })} />
          </Field>
        </div>
        <Field label="Referencia" hint="Número de operación o de e-cheq.">
          <Input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
        </Field>
        <Field label="Comprobante" required error={errores.comprobanteUrl} hint="Foto o PDF de la transferencia, el e-cheq o el recibo.">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="text-sm"
              onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])}
              data-testid="comprobante"
              aria-label="Comprobante"
            />
            {subiendo && <span className="text-xs text-gris-medio">Subiendo…</span>}
            {comprobante && <span className="text-xs text-[#2f7d4f]">✓ {comprobante.nombre}</span>}
          </div>
        </Field>
        {pendientes.length > 0 && (
          <div>
            <p className="mb-2 font-medium">¿Qué pedidos pagás? (opcional)</p>
            <div className="space-y-1">
              {pendientes.map((p) => (
                <Checkbox
                  key={p.id}
                  label={`${p.numero} · pendiente ${formatPrecio(p.pendiente)} · vence ${formatFecha(p.venceEn)}`}
                  checked={pedidos.includes(p.id)}
                  onChange={(e) => setPedidos(e.target.checked ? [...pedidos, p.id] : pedidos.filter((x) => x !== p.id))}
                />
              ))}
            </div>
          </div>
        )}
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
