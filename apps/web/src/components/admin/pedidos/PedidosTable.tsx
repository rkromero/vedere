'use client';
// Listado de pedidos del backoffice: filtros por estado, pago, óptica, fecha, línea y canal;
// búsqueda por número, email o DNI; exportación CSV con los mismos filtros.
import Link from 'next/link';
import { Badge, EmptyState, Input, PageHeader } from '@/components/admin/ui';
import {
  FilterSelect,
  Pagination,
  SearchInput,
  Table,
  Td,
  Th,
  Toolbar,
  Tr,
  useQueryParams,
} from '@/components/admin/table';
import { LABELS, formatFecha, formatPrecio, options } from '@/lib/format';
import {
  CANAL_LABEL,
  ESTADOS_PEDIDO,
  ESTADO_PEDIDO_LABEL,
  estadoPagoTone,
  estadoPedidoTone,
} from '@/lib/pedidos';
import type { PedidoFila, PedidosResumen } from '@/lib/pedidos';
import { ESTADO_PAGO_LABEL, METODO_PAGO_LABEL, MODALIDAD_LABEL } from '@/lib/tienda/checkout';
import type { Paged } from '@/lib/types';

function Resumen({ resumen }: { resumen: PedidosResumen }) {
  const { set } = useQueryParams();
  const chips: Array<{ label: string; value: number; tone: 'warn' | 'danger' | 'info' | 'ok'; onClick: () => void }> = [
    { label: 'Sin asignar', value: resumen.sinAsignar, tone: 'danger', onClick: () => set({ opticaId: 'sin', estado: undefined }) },
    { label: 'Pendientes de pago', value: resumen.porEstado.PENDIENTE_PAGO ?? 0, tone: 'warn', onClick: () => set({ estado: 'PENDIENTE_PAGO', opticaId: undefined }) },
    { label: 'Esperando a la óptica', value: resumen.porEstado.ASIGNADO ?? 0, tone: 'info', onClick: () => set({ estado: 'ASIGNADO', opticaId: undefined }) },
    { label: 'En armado', value: resumen.porEstado.EN_ARMADO ?? 0, tone: 'info', onClick: () => set({ estado: 'EN_ARMADO', opticaId: undefined }) },
    { label: 'Listos / enviados', value: (resumen.porEstado.LISTO ?? 0) + (resumen.porEstado.ENVIADO ?? 0), tone: 'info', onClick: () => set({ estado: 'LISTO', opticaId: undefined }) },
    { label: 'Entregados', value: resumen.porEstado.ENTREGADO ?? 0, tone: 'ok', onClick: () => set({ estado: 'ENTREGADO', opticaId: undefined }) },
  ];
  return (
    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={c.onClick}
          className="rounded-xl border border-negro/10 bg-blanco px-4 py-3 text-left transition-colors hover:border-negro/40"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-gris-medio">{c.label}</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">
            {c.value}
            {c.value > 0 && c.tone === 'danger' && <Badge tone="danger">atención</Badge>}
          </p>
        </button>
      ))}
      {resumen.solicitudesPendientes > 0 && (
        <Link
          href="/admin/solicitudes?estado=PENDIENTE"
          className="col-span-2 flex items-center justify-between rounded-xl border border-sol bg-sol/20 px-4 py-3 text-sm sm:col-span-3 lg:col-span-6"
        >
          <span>
            {resumen.solicitudesPendientes}{' '}
            {resumen.solicitudesPendientes === 1 ? 'solicitud de cambio o devolución pendiente' : 'solicitudes de cambio o devolución pendientes'}
          </span>
          <span className="underline underline-offset-2">Ver bandeja</span>
        </Link>
      )}
    </div>
  );
}

function FechaFiltro({ param, label }: { param: 'desde' | 'hasta'; label: string }) {
  const { get, set } = useQueryParams();
  return (
    <label className="flex items-center gap-2 text-xs text-gris-medio">
      {label}
      <Input
        type="date"
        value={get(param)}
        onChange={(e) => set({ [param]: e.target.value || undefined })}
        className="h-10 w-40"
        aria-label={label}
      />
    </label>
  );
}

export function PedidosTable({
  data,
  opticas,
  exportHref,
}: {
  data: Paged<PedidoFila> & { resumen: PedidosResumen };
  opticas: Array<{ id: string; nombre: string }>;
  exportHref: string;
}) {
  const ahora = Date.now();
  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Todos los pedidos de la tienda, su pago, la óptica asignada y su estado."
        actions={
          <a
            href={exportHref}
            className="inline-flex h-10 items-center rounded-lg border border-negro/20 bg-blanco px-4 text-sm font-medium hover:bg-gris-claro"
          >
            Exportar CSV
          </a>
        }
      />

      <Resumen resumen={data.resumen} />

      <Toolbar>
        <SearchInput placeholder="Número, email, nombre, DNI o factura…" />
        <FilterSelect
          param="estado"
          label="Estado"
          options={ESTADOS_PEDIDO.map((e) => ({ value: e, label: ESTADO_PEDIDO_LABEL[e] }))}
        />
        <FilterSelect
          param="estadoPago"
          label="Pago"
          options={Object.entries(ESTADO_PAGO_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          param="opticaId"
          label="Óptica"
          allLabel="Todas"
          options={[{ value: 'sin', label: 'Sin asignar' }, ...opticas.map((o) => ({ value: o.id, label: o.nombre }))]}
        />
        <FilterSelect param="linea" label="Línea" allLabel="Todas" options={options(LABELS.linea)} />
        <FilterSelect
          param="canal"
          label="Canal"
          options={Object.entries(CANAL_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          param="metodoPago"
          label="Medio"
          options={Object.entries(METODO_PAGO_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <FechaFiltro param="desde" label="Desde" />
        <FechaFiltro param="hasta" label="Hasta" />
      </Toolbar>

      {data.items.length === 0 ? (
        <EmptyState
          title="No hay pedidos con esos filtros"
          description="Probá quitando filtros o buscando por número de pedido, email o DNI."
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Pedido</Th>
                <Th>Cliente</Th>
                <Th>Estado</Th>
                <Th>Pago</Th>
                <Th>Óptica</Th>
                <Th>Entrega</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => {
                const vencido = p.estado === 'ASIGNADO' && p.aceptarAntesDe && new Date(p.aceptarAntesDe).getTime() < ahora;
                return (
                  <Tr key={p.id}>
                    <Td>
                      <Link href={`/admin/pedidos/${p.id}`} className="font-mono text-sm font-medium underline-offset-2 hover:underline">
                        {p.numero}
                      </Link>
                      <span className="block text-xs text-gris-medio">
                        {formatFecha(p.createdAt, true)} · {CANAL_LABEL[p.canal]}
                      </span>
                      <span className="block text-xs text-gris-medio">
                        {p.items} {p.items === 1 ? 'ítem' : 'ítems'}
                        {p.lineas.length > 0 && ` · ${p.lineas.map((l) => LABELS.linea[l]).join(', ')}`}
                        {p.solicitudes > 0 && (
                          <Badge tone="warn" className="ml-2">
                            {p.solicitudes === 1 ? '1 solicitud' : `${p.solicitudes} solicitudes`}
                          </Badge>
                        )}
                      </span>
                    </Td>
                    <Td>
                      <p className="font-medium">{p.cliente.nombre}</p>
                      <p className="text-xs text-gris-medio">{p.cliente.email}</p>
                      {p.cliente.dni && <p className="text-xs text-gris-medio">DNI {p.cliente.dni}</p>}
                    </Td>
                    <Td>
                      <Badge tone={estadoPedidoTone(p.estado)}>{ESTADO_PEDIDO_LABEL[p.estado]}</Badge>
                      {vencido && (
                        <span className="mt-1 block text-xs text-carey">Plazo de aceptación vencido</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={estadoPagoTone(p.estadoPago)}>{ESTADO_PAGO_LABEL[p.estadoPago]}</Badge>
                      <span className="mt-1 block text-xs text-gris-medio">{METODO_PAGO_LABEL[p.metodoPago]}</span>
                    </Td>
                    <Td>
                      {p.optica ? (
                        <span>{p.optica.nombre}</span>
                      ) : p.estado === 'PAGADO' ? (
                        <Badge tone="danger">Sin asignar</Badge>
                      ) : (
                        <span className="text-gris-medio">—</span>
                      )}
                    </Td>
                    <Td className="text-xs">
                      {MODALIDAD_LABEL[p.modalidad]}
                      {p.localidad && <span className="block text-gris-medio">{p.localidad}</span>}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrecio(p.total)}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} />
        </>
      )}
    </>
  );
}
