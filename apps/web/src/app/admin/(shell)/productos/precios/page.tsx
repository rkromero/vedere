// Historial auditado de actualizaciones masivas de precios (quién, cuándo, qué precio, alcance y detalle).
import type { Metadata } from 'next';
import { Pagination, Table, Td, Th, Tr } from '@/components/admin/table';
import { Badge, EmptyState, LinkBtn, PageHeader } from '@/components/admin/ui';
import { qs, serverApi } from '@/lib/api-server';
import { formatFecha, formatPrecio } from '@/lib/format';
import type { Paged } from '@/lib/types';

export const metadata: Metadata = { title: 'Historial de precios' };
export const dynamic = 'force-dynamic';

interface Actualizacion {
  id: string;
  campo: 'PRECIO' | 'PRECIO_MAYORISTA';
  porcentaje: number;
  alcance: 'TODOS' | 'CATEGORIA' | 'MARCA' | 'COLECCION';
  alcanceNombre: string | null;
  productosAfectados: number;
  detalle: Array<{ id: string; nombre: string; antes: number; despues: number }>;
  usuarioNombre: string | null;
  createdAt: string;
}

const ALCANCE: Record<Actualizacion['alcance'], string> = {
  TODOS: 'Todos',
  CATEGORIA: 'Categoría',
  MARCA: 'Marca',
  COLECCION: 'Colección',
};

type SP = Record<string, string | string[] | undefined>;

export default async function HistorialPreciosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const data = await serverApi<Paged<Actualizacion>>(
    `/admin/productos/precios/historial${qs({ page: sp.page, pageSize: '20' })}`,
  );

  return (
    <>
      <PageHeader
        title="Historial de precios"
        description="Actualizaciones masivas por porcentaje: quién las hizo, cuándo y cómo quedó cada producto."
        actions={
          <LinkBtn href="/admin/productos" variant="secondary">
            Volver a productos
          </LinkBtn>
        }
      />
      {data.items.length === 0 ? (
        <EmptyState
          title="Todavía no hubo actualizaciones masivas"
          description="Usá «Actualizar precios» en el listado de productos."
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Precio</Th>
                <Th align="right">Cambio</Th>
                <Th>Alcance</Th>
                <Th align="right">Productos</Th>
                <Th>Usuario</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <Tr key={a.id}>
                  <Td>{formatFecha(a.createdAt, true)}</Td>
                  <Td>
                    <Badge tone={a.campo === 'PRECIO' ? 'info' : 'neutral'}>
                      {a.campo === 'PRECIO' ? 'Web' : 'Mayorista'}
                    </Badge>
                  </Td>
                  <Td align="right" className="font-medium tabular-nums">
                    {a.porcentaje > 0 ? '+' : ''}
                    {a.porcentaje.toLocaleString('es-AR')}%
                  </Td>
                  <Td>
                    {ALCANCE[a.alcance]}
                    {a.alcance !== 'TODOS' && a.alcanceNombre ? `: ${a.alcanceNombre}` : ''}
                  </Td>
                  <Td align="right">
                    <details className="inline-block text-left">
                      <summary className="cursor-pointer text-right underline-offset-2 hover:underline">
                        {a.productosAfectados}
                      </summary>
                      <ul className="mt-2 max-h-56 min-w-72 overflow-auto rounded-lg border border-negro/10 bg-blanco p-2 text-xs">
                        {a.detalle.map((d) => (
                          <li key={d.id} className="flex justify-between gap-4 py-0.5">
                            <span className="truncate">{d.nombre}</span>
                            <span className="shrink-0 tabular-nums">
                              <span className="text-gris-medio">{formatPrecio(d.antes)}</span> → {formatPrecio(d.despues)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </Td>
                  <Td>{a.usuarioNombre ?? '—'}</Td>
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
