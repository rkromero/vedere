import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, LinkBtn, PageHeader } from '@/components/admin/ui';
import { estadoTone } from '@/lib/format';
import { Table, Td, Th, Tr } from '@/components/admin/table';
import { serverApiOrNull } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import type { Dashboard } from '@/lib/types';
import { LABELS } from '@/lib/format';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

function Stat({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number;
  href: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-negro/10 bg-blanco p-5 transition-colors hover:border-negro/40"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gris-medio">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-gris-medio">{hint}</p>}
    </Link>
  );
}

export default async function DashboardPage() {
  const [user, data] = await Promise.all([
    getSession(),
    serverApiOrNull<Dashboard>('/admin/dashboard'),
  ]);
  const esAdmin = user?.rol === 'ADMIN';
  const bajoStock = data?.variantesBajoStock ?? [];

  return (
    <>
      <PageHeader
        title={`Hola, ${user?.nombre ?? 'equipo'}`}
        description="Resumen del catálogo y alertas de stock."
        actions={
          <>
            <LinkBtn href="/admin/productos/nuevo">Nuevo producto</LinkBtn>
            <LinkBtn href="/admin/productos" variant="secondary">
              Importar CSV
            </LinkBtn>
            <LinkBtn href="/" variant="ghost">
              Ver tienda
            </LinkBtn>
          </>
        }
      />

      {!data ? (
        <EmptyState
          title="No se pudo cargar el resumen"
          description="La API no respondió. Revisá el estado en Configuración."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Productos"
              value={data.productos.total}
              href="/admin/productos"
              hint="Total en el catálogo"
            />
            <Stat
              label="Publicados"
              value={data.productos.publicados}
              href="/admin/productos?estado=PUBLICADO"
              hint="Visibles en la tienda"
            />
            <Stat
              label="Borradores"
              value={data.productos.borradores}
              href="/admin/productos?estado=BORRADOR"
            />
            <Stat
              label="Archivados"
              value={data.productos.archivados}
              href="/admin/productos?estado=ARCHIVADO"
            />
          </div>
          <div
            className={`mb-8 grid grid-cols-2 gap-3 ${esAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}
          >
            <Stat label="Marcas" value={data.marcas} href="/admin/marcas" />
            <Stat label="Categorías" value={data.categorias} href="/admin/categorias" />
            <Stat label="Colecciones" value={data.colecciones} href="/admin/colecciones" />
            {esAdmin && <Stat label="Usuarios" value={data.usuarios} href="/admin/usuarios" />}
          </div>

          <Card
            className={bajoStock.length ? 'border-l-4 border-l-sol' : ''}
            title={
              <span className="flex items-center gap-2">
                Alerta de stock
                {bajoStock.length > 0 && <Badge tone="warn">{bajoStock.length} variantes</Badge>}
              </span>
            }
            actions={
              bajoStock.length > 0 ? (
                <Link
                  href="/admin/productos?bajoStock=true"
                  className="text-xs underline-offset-2 hover:underline"
                >
                  Ver productos con stock bajo
                </Link>
              ) : undefined
            }
          >
            {bajoStock.length === 0 ? (
              <p className="text-sm text-gris-medio">Todo el stock está por encima del mínimo.</p>
            ) : (
              <Table className="border-0">
                <thead>
                  <tr>
                    <Th>SKU</Th>
                    <Th>Producto</Th>
                    <Th>Color</Th>
                    <Th align="right">Stock / mínimo</Th>
                    <Th align="right">Faltante</Th>
                    <Th>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {bajoStock.map((v) => (
                    <Tr key={v.id}>
                      <Td className="font-mono text-xs">{v.sku}</Td>
                      <Td>
                        <Link
                          href={`/admin/productos/${v.producto.id}`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {v.producto.nombre}
                        </Link>
                      </Td>
                      <Td>{v.colorArmazon}</Td>
                      <Td align="right" className="tabular-nums">
                        {v.stock} / {v.stockMinimo}
                      </Td>
                      <Td align="right">
                        <Badge tone="warn">-{v.faltante}</Badge>
                      </Td>
                      <Td>
                        <Badge tone={estadoTone(v.producto.estado)}>
                          {LABELS.estado[v.producto.estado as keyof typeof LABELS.estado] ??
                            v.producto.estado}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </>
  );
}
