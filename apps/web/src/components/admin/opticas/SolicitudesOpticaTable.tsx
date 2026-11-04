'use client';
// Bandeja de solicitudes de alta de ópticas: filtro por estado, búsqueda y acceso al detalle para resolver.
import Link from 'next/link';
import { cn } from '@vedere/ui';
import { formatFecha } from '@/lib/format';
import type { EstadoSolicitudOptica, Paged, SolicitudOptica } from '@/lib/types';
import { Pagination, SearchInput, Table, Td, Th, Toolbar, Tr } from '@/components/admin/table';
import { Badge, EmptyState, PageHeader } from '@/components/admin/ui';
import { ESTADO_SOLICITUD, TONO_SOLICITUD } from './solicitud-labels';

export function SolicitudesOpticaTable({
  data,
  resumen,
  estado,
}: {
  data: Paged<SolicitudOptica>;
  resumen: Partial<Record<EstadoSolicitudOptica, number>>;
  estado: string;
}) {
  const filtros: Array<{ value: string; label: string; n?: number }> = [
    { value: 'PENDIENTE', label: 'Pendientes', n: resumen.PENDIENTE ?? 0 },
    { value: 'APROBADA', label: 'Aprobadas', n: resumen.APROBADA ?? 0 },
    { value: 'RECHAZADA', label: 'Rechazadas', n: resumen.RECHAZADA ?? 0 },
    { value: 'todas', label: 'Todas' },
  ];

  return (
    <>
      <PageHeader
        title="Solicitudes de ópticas"
        description="Ópticas que pidieron sumarse desde /opticas/sumate. Al aprobar se crea la óptica y su usuario con contraseña provisoria."
      />
      <Toolbar>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Estado">
          {filtros.map((f) => (
            <Link
              key={f.value}
              href={`/admin/opticas/solicitudes?estado=${f.value}`}
              aria-current={estado === f.value ? 'true' : undefined}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm',
                estado === f.value ? 'border-negro bg-negro text-blanco' : 'border-negro/15 hover:border-negro/40',
              )}
            >
              {f.label}
              {f.n !== undefined && <span className="tabular-nums opacity-70">{f.n}</span>}
            </Link>
          ))}
        </div>
        <SearchInput placeholder="Buscar por nombre, razón social, CUIT, email o localidad…" />
      </Toolbar>

      {data.items.length === 0 ? (
        <EmptyState
          title={estado === 'PENDIENTE' ? 'No hay solicitudes pendientes' : 'No hay solicitudes para mostrar'}
          description="Las ópticas se postulan desde la página «Sumá tu óptica» de la tienda."
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Recibida</Th>
                <Th>Óptica</Th>
                <Th>CUIT</Th>
                <Th>Ubicación</Th>
                <Th>Responsable</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <Tr key={s.id}>
                  <Td>{formatFecha(s.createdAt, true)}</Td>
                  <Td>
                    <Link href={`/admin/opticas/solicitudes/${s.id}`} className="font-medium hover:underline">
                      {s.nombreComercial}
                    </Link>
                    <div className="text-xs text-gris-medio">{s.razonSocial}</div>
                  </Td>
                  <Td className="font-mono text-xs">{s.cuit}</Td>
                  <Td>
                    {s.localidad}
                    <div className="text-xs text-gris-medio">{s.provincia}</div>
                  </Td>
                  <Td>
                    {s.opticoResponsable}
                    <div className="text-xs text-gris-medio">{s.email}</div>
                  </Td>
                  <Td>
                    <Badge tone={TONO_SOLICITUD[s.estado]}>{ESTADO_SOLICITUD[s.estado]}</Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} />
        </>
      )}
    </>
  );
}
