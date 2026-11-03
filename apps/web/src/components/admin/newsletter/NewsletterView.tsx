'use client';
// Suscriptores del newsletter: tabla paginada con búsqueda, filtro activos/bajas, CSV y eliminación.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api-client';
import { Badge, Btn, ConfirmDialog, EmptyState, PageHeader } from '@/components/admin/ui';
import { FilterSelect, Pagination, SearchInput, Table, Td, Th, Toolbar, Tr } from '@/components/admin/table';
import { useToast } from '@/components/admin/toast';
import { formatFecha } from '@/lib/format';
import type { Paged } from '@/lib/types';
import type { SuscriptorNewsletter } from '@/lib/admin/prompt6';

export function NewsletterView({
  data,
  csvHref,
}: {
  data: (Paged<SuscriptorNewsletter> & { resumen?: { activos: number; bajas: number } }) | null;
  csvHref: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [toDelete, setToDelete] = useState<SuscriptorNewsletter | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function eliminar() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/admin/newsletter/${toDelete.id}`);
      toast.ok(`${toDelete.email} eliminado del newsletter`);
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  const resumen = data?.resumen;

  return (
    <>
      <PageHeader
        title="Newsletter"
        description="Altas desde la home, el checkout y Mi cuenta. Cada email de marketing lleva su link de baja en un clic."
        actions={
          <a href={csvHref} className="inline-flex h-10 items-center rounded-lg border border-negro/20 bg-blanco px-4 text-sm font-medium hover:bg-gris-claro">
            Exportar CSV
          </a>
        }
      />

      {resumen && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Stat label="Activos" value={resumen.activos} />
          <Stat label="Bajas" value={resumen.bajas} />
          <Stat label="Total" value={resumen.activos + resumen.bajas} />
        </div>
      )}

      <Toolbar>
        <SearchInput placeholder="Buscar por email o nombre…" />
        <FilterSelect
          param="estado"
          label="Estado"
          options={[
            { value: 'activos', label: 'Activos' },
            { value: 'bajas', label: 'Bajas' },
          ]}
        />
      </Toolbar>

      {!data ? (
        <EmptyState title="No se pudieron cargar los suscriptores" description="La API no respondió a /admin/newsletter." />
      ) : data.items.length === 0 ? (
        <EmptyState title="Sin suscriptores" description="Los emails del bloque de newsletter de la tienda aparecen acá." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Nombre</Th>
                <Th>Origen</Th>
                <Th>Estado</Th>
                <Th>Alta</Th>
                <Th align="right"> </Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <Tr key={s.id}>
                  <Td className="font-medium">{s.email}</Td>
                  <Td>{s.nombre ?? '—'}</Td>
                  <Td className="text-gris-medio">{s.origen ?? '—'}</Td>
                  <Td>
                    {s.bajaEn ? (
                      <Badge tone="warn" className="whitespace-nowrap">
                        Baja {formatFecha(s.bajaEn)}
                      </Badge>
                    ) : (
                      <Badge tone="ok">Activo</Badge>
                    )}
                  </Td>
                  <Td className="text-gris-medio">{formatFecha(s.createdAt, true)}</Td>
                  <Td align="right">
                    <Btn size="sm" variant="ghost" className="text-carey" onClick={() => setToDelete(s)}>
                      Eliminar
                    </Btn>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} />
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void eliminar()}
        title="Eliminar suscriptor"
        description={toDelete ? `${toDelete.email} se borra de la lista. Si quiere volver, puede suscribirse de nuevo.` : undefined}
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-negro/10 bg-blanco px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gris-medio">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
