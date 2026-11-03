'use client';
// Botón de arrepentimiento (Res. 424/2020): solicitudes con número de trámite, filtro por estado, detalle y
// resolución (cambio de estado + respuesta al cliente).
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { Badge, Btn, EmptyState, Field, Modal, PageHeader, Select, Textarea } from '@/components/admin/ui';
import { FilterSelect, Pagination, SearchInput, Table, Td, Th, Toolbar, Tr } from '@/components/admin/table';
import { useToast } from '@/components/admin/toast';
import { formatFecha } from '@/lib/format';
import type { BadgeTone } from '@/lib/format';
import type { Paged } from '@/lib/types';
import type { Arrepentimiento, EstadoArrepentimiento, ResumenArrepentimientos } from '@/lib/admin/prompt6';
import { ESTADOS_ARREPENTIMIENTO, ESTADO_ARREPENTIMIENTO_LABEL } from '@/lib/admin/prompt6';

const TONE: Record<EstadoArrepentimiento, BadgeTone> = {
  RECIBIDO: 'warn',
  EN_PROCESO: 'info',
  RESUELTO: 'ok',
  RECHAZADO: 'danger',
};

export function ArrepentimientosView({ data }: { data: (Paged<Arrepentimiento> & { resumen?: ResumenArrepentimientos }) | null }) {
  const router = useRouter();
  const toast = useToast();
  const [sel, setSel] = useState<Arrepentimiento | null>(null);
  const [form, setForm] = useState<{ estado: EstadoArrepentimiento; respuesta: string }>({ estado: 'RECIBIDO', respuesta: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function abrir(a: Arrepentimiento) {
    setSel(a);
    setErrors({});
    setForm({ estado: a.estado, respuesta: a.respuesta ?? '' });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!sel) return;
    setSaving(true);
    setErrors({});
    try {
      await api.put(`/admin/arrepentimientos/${sel.id}`, { estado: form.estado, respuesta: form.respuesta.trim() || null });
      toast.ok(
        form.estado === 'RESUELTO' || form.estado === 'RECHAZADO'
          ? `Trámite ${sel.numeroTramite} ${ESTADO_ARREPENTIMIENTO_LABEL[form.estado].toLowerCase()}: se avisó al cliente por email`
          : `Trámite ${sel.numeroTramite} actualizado`,
      );
      setSel(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const resumen = data?.resumen;
  const pendientes = resumen ? resumen.RECIBIDO + resumen.EN_PROCESO : null;

  return (
    <>
      <PageHeader
        title="Arrepentimientos"
        description="Solicitudes del botón de arrepentimiento (Res. 424/2020). Cada una tiene número de trámite; hay 10 días corridos desde la compra o la entrega para resolverlas."
        actions={pendientes !== null ? <Badge tone={pendientes > 0 ? 'warn' : 'ok'}>{pendientes} pendientes</Badge> : undefined}
      />

      {resumen && (
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          {ESTADOS_ARREPENTIMIENTO.map((e) => (
            <div key={e} className="rounded-xl border border-negro/10 bg-blanco px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gris-medio">{ESTADO_ARREPENTIMIENTO_LABEL[e]}</p>
              <p className="mt-1 text-2xl font-semibold">{resumen[e] ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      <Toolbar>
        <SearchInput placeholder="Número de trámite, email, nombre o pedido…" />
        <FilterSelect param="estado" label="Estado" options={ESTADOS_ARREPENTIMIENTO.map((e) => ({ value: e, label: ESTADO_ARREPENTIMIENTO_LABEL[e] }))} />
      </Toolbar>

      {!data ? (
        <EmptyState title="No se pudieron cargar los trámites" description="La API no respondió a /admin/arrepentimientos." />
      ) : data.items.length === 0 ? (
        <EmptyState title="Sin solicitudes" description="Cuando un cliente use el botón de arrepentimiento de la tienda, aparece acá con su número de trámite." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Trámite</Th>
                <Th>Cliente</Th>
                <Th>Pedido</Th>
                <Th>Motivo</Th>
                <Th>Estado</Th>
                <Th>Recibido</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <Tr key={a.id} onClick={() => abrir(a)}>
                  <Td className="font-mono text-xs font-medium">{a.numeroTramite}</Td>
                  <Td>
                    <p className="font-medium">{a.nombre}</p>
                    <p className="text-xs text-gris-medio">{a.email}</p>
                  </Td>
                  <Td>
                    {a.pedidoId ? (
                      <Link href={`/admin/pedidos/${a.pedidoId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs underline underline-offset-2">
                        {a.pedidoNumero}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-gris-medio">{a.pedidoNumero ?? '—'}</span>
                    )}
                  </Td>
                  <Td className="max-w-xs truncate text-negro/80">{a.motivo ?? '—'}</Td>
                  <Td>
                    <Badge tone={TONE[a.estado]}>{ESTADO_ARREPENTIMIENTO_LABEL[a.estado]}</Badge>
                  </Td>
                  <Td className="text-gris-medio">{formatFecha(a.createdAt, true)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} />
        </>
      )}

      <Modal open={sel !== null} onClose={() => setSel(null)} title={sel ? `Trámite ${sel.numeroTramite}` : ''} size="md">
        {sel && (
          <form onSubmit={guardar} className="space-y-4">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Dato label="Cliente">{sel.nombre}</Dato>
              <Dato label="Email">
                <a href={`mailto:${sel.email}`} className="underline underline-offset-2">
                  {sel.email}
                </a>
              </Dato>
              <Dato label="DNI">{sel.dni ?? '—'}</Dato>
              <Dato label="Teléfono">{sel.telefono ?? '—'}</Dato>
              <Dato label="Pedido">
                {sel.pedidoId ? (
                  <Link href={`/admin/pedidos/${sel.pedidoId}`} className="font-mono underline underline-offset-2">
                    {sel.pedidoNumero}
                  </Link>
                ) : (
                  <span className="font-mono">{sel.pedidoNumero ?? '—'}</span>
                )}
              </Dato>
              <Dato label="Recibido">{formatFecha(sel.createdAt, true)}</Dato>
              {sel.resueltoEn && <Dato label="Resuelto">{formatFecha(sel.resueltoEn, true)}</Dato>}
            </dl>
            <div className="rounded-lg bg-gris-claro/60 p-3 text-sm">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gris-medio">Motivo</p>
              <p className="whitespace-pre-wrap">{sel.motivo ?? 'Sin motivo indicado.'}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
              <Field label="Estado" error={errors.estado}>
                <Select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoArrepentimiento })}>
                  {ESTADOS_ARREPENTIMIENTO.map((e) => (
                    <option key={e} value={e}>
                      {ESTADO_ARREPENTIMIENTO_LABEL[e]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Respuesta al cliente" error={errors.respuesta} hint="Al marcar Resuelto o Rechazado se le manda por email.">
                <Textarea value={form.respuesta} onChange={(e) => setForm({ ...form, respuesta: e.target.value })} rows={4} maxLength={2000} />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => setSel(null)}>
                Cerrar
              </Btn>
              <Btn type="submit" loading={saving}>
                Guardar
              </Btn>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gris-medio">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
