'use client';
// Listado de páginas legales editables (términos, privacidad, cambios, cookies).
import Link from 'next/link';
import { Badge, EmptyState, PageHeader } from '@/components/admin/ui';
import { Table, Td, Th, Tr } from '@/components/admin/table';
import { formatFecha } from '@/lib/format';
import type { PaginaLegal } from '@/lib/admin/prompt6';

/** URL pública de cada página según su slug. */
export function urlPublicaLegal(slug: string): string {
  return slug === 'cambios' ? '/cambios-y-devoluciones' : `/legal/${slug}`;
}

export function PaginasLegalesTable({ items }: { items: PaginaLegal[] | null }) {
  if (!items) {
    return (
      <>
        <PageHeader title="Páginas legales" />
        <EmptyState title="No se pudieron cargar las páginas" description="La API no respondió a /admin/paginas-legales." />
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Páginas legales"
        description="Términos y condiciones, privacidad, cambios y devoluciones y cookies. Se escriben en Markdown y se publican en la tienda al guardar."
      />
      {items.length === 0 ? (
        <EmptyState title="Todavía no hay páginas" description="Corré el seed para crear las páginas por defecto." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Página</Th>
              <Th>URL pública</Th>
              <Th>Estado</Th>
              <Th>Actualizada</Th>
              <Th align="right"> </Th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <Tr key={p.slug}>
                <Td>
                  <Link href={`/admin/legal/${p.slug}`} className="font-medium underline-offset-2 hover:underline">
                    {p.titulo}
                  </Link>
                  {p.intro && <p className="mt-0.5 max-w-md truncate text-xs text-gris-medio">{p.intro}</p>}
                </Td>
                <Td>
                  <a href={urlPublicaLegal(p.slug)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs underline-offset-2 hover:underline">
                    {urlPublicaLegal(p.slug)}
                  </a>
                </Td>
                <Td>
                  <Badge tone={p.publicada ? 'ok' : 'warn'}>{p.publicada ? 'Publicada' : 'Borrador'}</Badge>
                </Td>
                <Td className="text-gris-medio">{formatFecha(p.updatedAt, true)}</Td>
                <Td align="right">
                  <Link href={`/admin/legal/${p.slug}`} className="text-sm underline underline-offset-2">
                    Editar
                  </Link>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
