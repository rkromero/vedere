'use client';
// Pedidos asignados a la óptica: filtros por estado y fecha, búsqueda por número o cliente.
import Link from 'next/link';
import { Badge, EmptyState, Input, PageHeader } from '@/components/admin/ui';
import { FilterSelect, Pagination, SearchInput, Table, Td, Th, Toolbar, Tr, useQueryParams } from '@/components/admin/table';
import { LABELS, formatFecha, formatPrecio } from '@/lib/format';
import { ESTADO_PEDIDO_LABEL, estadoPedidoTone, labelEstadoPedido } from '@/lib/pedidos';
import type { EstadoPedido, PedidoOpticaFila } from '@/lib/pedidos';
import { MODALIDAD_LABEL } from '@/lib/tienda/checkout';
import type { Paged } from '@/lib/types';

const ESTADOS_OPTICA: EstadoPedido[] = ['ASIGNADO', 'ACEPTADO', 'EN_ARMADO', 'LISTO', 'ENVIADO', 'ENTREGADO', 'DEVUELTO', 'CANCELADO'];

function FechaFiltro({ param, label }: { param: 'desde' | 'hasta'; label: string }) {
  const { get, set } = useQueryParams();
  return (
    <label className="flex items-center gap-2 text-xs text-gris-medio">
      {label}
      <Input type="date" value={get(param)} onChange={(e) => set({ [param]: e.target.value || undefined })} className="h-10 w-40" aria-label={label} />
    </label>
  );
}

export function OpticaPedidosTable({ data }: { data: Paged<PedidoOpticaFila> & { resumen: Partial<Record<string, number>> } }) {
  const { set, get } = useQueryParams();
  const ahora = Date.now();
  const chips: Array<{ estado: EstadoPedido | ''; label: string }> = [
    { estado: '', label: 'Todos' },
    { estado: 'ASIGNADO', label: 'Para aceptar' },
    { estado: 'ACEPTADO', label: 'Aceptados' },
    { estado: 'EN_ARMADO', label: 'En armado' },
    { estado: 'LISTO', label: 'Listos' },
    { estado: 'ENVIADO', label: 'Enviados' },
    { estado: 'ENTREGADO', label: 'Entregados' },
  ];
  return (
    <>
      <PageHeader title="Pedidos" description="Pedidos asignados a tu óptica. Aceptalos dentro del plazo y avanzá el estado a medida que los armás y entregás." />
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((c) => {
          const activo = get('estado') === c.estado;
          const n = c.estado ? (data.resumen[c.estado] ?? 0) : Object.values(data.resumen).reduce<number>((a, b) => a + (b ?? 0), 0);
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => set({ estado: c.estado || undefined })}
              className={`rounded-full border px-3 py-1 text-sm ${activo ? 'border-negro bg-negro text-blanco' : 'border-negro/20 bg-blanco hover:bg-gris-claro'}`}
            >
              {c.label} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          );
        })}
      </div>
      <Toolbar>
        <SearchInput placeholder="Número de pedido, cliente, email o DNI…" />
        <FilterSelect param="estado" label="Estado" options={ESTADOS_OPTICA.map((e) => ({ value: e, label: ESTADO_PEDIDO_LABEL[e] }))} />
        <FechaFiltro param="desde" label="Asignado desde" />
        <FechaFiltro param="hasta" label="hasta" />
      </Toolbar>

      {data.items.length === 0 ? (
        <EmptyState title="Sin pedidos" description="Cuando Vedere te asigne un pedido vas a verlo acá y vas a recibir un email." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Pedido</Th>
                <Th>Cliente</Th>
                <Th>Estado</Th>
                <Th>Entrega</Th>
                <Th>Fechas</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => {
                const vencido = p.estado === 'ASIGNADO' && p.aceptarAntesDe && new Date(p.aceptarAntesDe).getTime() < ahora;
                return (
                  <Tr key={p.id}>
                    <Td>
                      <Link href={`/optica/pedidos/${p.id}`} className="font-mono font-medium underline-offset-2 hover:underline">
                        {p.numero}
                      </Link>
                      <span className="block text-xs text-gris-medio">
                        {p.items} {p.items === 1 ? 'ítem' : 'ítems'} · {p.lineas.map((l) => LABELS.linea[l]).join(', ')}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {p.conReceta && <Badge tone="info">Con receta</Badge>}
                        {p.turnos > 0 && <Badge tone="neutral">{p.turnos === 1 ? '1 turno' : `${p.turnos} turnos`}</Badge>}
                      </span>
                    </Td>
                    <Td>
                      <p className="font-medium">{p.cliente.nombre}</p>
                      {p.cliente.telefono && <p className="text-xs text-gris-medio">{p.cliente.telefono}</p>}
                    </Td>
                    <Td>
                      <Badge tone={estadoPedidoTone(p.estado)}>{labelEstadoPedido(p.estado, p.modalidad)}</Badge>
                      {p.estado === 'ASIGNADO' && p.aceptarAntesDe && (
                        <span className={`mt-1 block text-xs ${vencido ? 'text-carey' : 'text-gris-medio'}`}>
                          {vencido ? 'Plazo vencido' : `Aceptar antes de ${formatFecha(p.aceptarAntesDe, true)}`}
                        </span>
                      )}
                    </Td>
                    <Td className="text-xs">
                      {MODALIDAD_LABEL[p.modalidad]}
                      {p.localidad && <span className="block text-gris-medio">{p.localidad}</span>}
                    </Td>
                    <Td className="text-xs text-gris-medio">
                      <span className="block">Asignado {formatFecha(p.asignadoEn, true)}</span>
                      {p.entregadoEn && <span className="block">Entregado {formatFecha(p.entregadoEn, true)}</span>}
                    </Td>
                    <Td align="right" className="tabular-nums">{formatPrecio(p.total)}</Td>
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
