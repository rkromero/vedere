'use client';
// Bandeja de solicitudes de cambio / devolución: aprobar (nuevo pedido sin cargo o reintegro) o rechazar.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { formatFecha, formatPrecio } from '@/lib/format';
import {
  ESTADO_PEDIDO_LABEL,
  ESTADO_SOLICITUD_LABEL,
  RESOLUCION_LABEL,
  TIPO_SOLICITUD_LABEL,
  estadoPedidoTone,
} from '@/lib/pedidos';
import type { Solicitud, SolicitudFila } from '@/lib/pedidos';
import type { Paged } from '@/lib/types';
import { Badge, Btn, EmptyState, PageHeader } from '@/components/admin/ui';
import { FilterSelect, Pagination, Table, Td, Th, Toolbar, Tr } from '@/components/admin/table';
import { useToast } from '@/components/admin/toast';
import { SolicitudModal } from '@/components/admin/pedidos/PedidoDetalle';

export function SolicitudesTable({ data }: { data: Paged<SolicitudFila> & { pendientes: number } }) {
  const router = useRouter();
  const toast = useToast();
  const [sel, setSel] = useState<Solicitud | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function ejecutar(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await fn();
      toast.ok(okMsg);
      setSel(null);
      router.refresh();
      return true;
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Cambios y devoluciones"
        description="Solicitudes de los clientes. Al aprobar, se genera un pedido nuevo sin cargo o se reintegra el dinero; el cliente recibe un email en cada paso."
      />
      <Toolbar>
        <FilterSelect
          param="estado"
          label="Estado"
          allLabel="Todas"
          options={Object.entries(ESTADO_SOLICITUD_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          param="tipo"
          label="Tipo"
          options={Object.entries(TIPO_SOLICITUD_LABEL).map(([value, label]) => ({ value, label }))}
        />
        {data.pendientes > 0 && <Badge tone="warn">{data.pendientes} pendientes</Badge>}
      </Toolbar>

      {data.items.length === 0 ? (
        <EmptyState title="No hay solicitudes" description="Cuando un cliente pida un cambio o una devolución desde la tienda, aparece acá." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Solicitud</Th>
                <Th>Pedido</Th>
                <Th>Cliente</Th>
                <Th>Estado</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <p className="font-medium">{TIPO_SOLICITUD_LABEL[s.tipo]}: {s.motivo}</p>
                    {s.detalle && <p className="text-xs text-gris-medio">{s.detalle}</p>}
                    <p className="text-xs text-gris-medio">{formatFecha(s.createdAt, true)}</p>
                  </Td>
                  <Td>
                    <Link href={`/admin/pedidos/${s.pedido.id}`} className="font-mono text-sm underline-offset-2 hover:underline">
                      {s.pedido.numero}
                    </Link>
                    <span className="block text-xs text-gris-medio">{formatPrecio(s.pedido.total)}{s.pedido.optica ? ` · ${s.pedido.optica.nombre}` : ''}</span>
                    <Badge tone={estadoPedidoTone(s.pedido.estado)} className="mt-1">{ESTADO_PEDIDO_LABEL[s.pedido.estado]}</Badge>
                  </Td>
                  <Td>
                    <p>{s.pedido.nombre}</p>
                    <p className="text-xs text-gris-medio">{s.pedido.email}</p>
                  </Td>
                  <Td>
                    <Badge tone={s.estado === 'PENDIENTE' ? 'warn' : s.estado === 'APROBADA' ? 'ok' : 'neutral'}>{ESTADO_SOLICITUD_LABEL[s.estado]}</Badge>
                    {s.resolucion && <span className="mt-1 block text-xs text-gris-medio">{RESOLUCION_LABEL[s.resolucion]}</span>}
                    {s.nuevoPedidoId && (
                      <Link href={`/admin/pedidos/${s.nuevoPedidoId}`} className="block text-xs underline underline-offset-2">Ver pedido nuevo</Link>
                    )}
                    {s.respuesta && <span className="mt-1 block text-xs text-gris-medio">{s.respuesta}</span>}
                  </Td>
                  <Td align="right">
                    {s.estado === 'PENDIENTE' && (
                      <Btn size="sm" onClick={() => { setError(null); setFieldErrors({}); setSel(s); }}>
                        Resolver
                      </Btn>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} />
        </>
      )}

      <SolicitudModal
        open={!!sel}
        solicitud={sel}
        busy={busy}
        error={error}
        fieldErrors={fieldErrors}
        onClose={() => setSel(null)}
        onAprobar={(body) => ejecutar(() => api.post(`/admin/solicitudes/${sel!.id}/aprobar`, body), 'Solicitud aprobada')}
        onRechazar={(body) => ejecutar(() => api.post(`/admin/solicitudes/${sel!.id}/rechazar`, body), 'Solicitud rechazada')}
      />
    </>
  );
}
