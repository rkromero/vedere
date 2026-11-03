'use client';
// Listado de plantillas de email editables (prompt 6).
import Link from 'next/link';
import { Badge, EmptyState, PageHeader } from '@/components/admin/ui';
import { Table, Td, Th, Tr } from '@/components/admin/table';
import type { PlantillaEmail } from '@/lib/admin/prompt6';

const GRUPOS: Array<{ titulo: string; prefijos: string[] }> = [
  { titulo: 'Cuenta', prefijos: ['BIENVENIDA', 'RECUPERAR_PASSWORD', 'REFERIDO_RECOMPENSA', 'PLAN_RIVEDERE'] },
  { titulo: 'Pedidos y pagos', prefijos: ['PEDIDO_CONFIRMADO', 'PAGO_RECHAZADO', 'ESTADO_'] },
  { titulo: 'Marketing', prefijos: ['CARRITO_ABANDONADO', 'VOLVIO_STOCK', 'NEWSLETTER_ALTA'] },
  { titulo: 'Legal', prefijos: ['ARREPENTIMIENTO'] },
];

function grupoDe(tipo: string): string {
  return GRUPOS.find((g) => g.prefijos.some((p) => tipo.startsWith(p)))?.titulo ?? 'Otros';
}

export function PlantillasTable({ items }: { items: PlantillaEmail[] | null }) {
  if (!items) {
    return (
      <>
        <PageHeader title="Plantillas de email" />
        <EmptyState title="No se pudieron cargar las plantillas" description="La API no respondió a /admin/plantillas-email." />
      </>
    );
  }
  const grupos = [...GRUPOS.map((g) => g.titulo), 'Otros']
    .map((titulo) => ({ titulo, items: items.filter((p) => grupoDe(p.tipo) === titulo) }))
    .filter((g) => g.items.length > 0);
  const personalizadas = items.filter((p) => p.personalizada).length;

  return (
    <>
      <PageHeader
        title="Plantillas de email"
        description={`Asunto, título, texto y botón de cada email que manda Vedere. ${personalizadas} de ${items.length} personalizadas; el resto usa el texto por defecto.`}
      />
      <div className="space-y-6">
        {grupos.map((g) => (
          <div key={g.titulo}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gris-medio">{g.titulo}</h2>
            <Table>
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Asunto</Th>
                  <Th>Estado</Th>
                  <Th align="right"> </Th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((p) => (
                  <Tr key={p.tipo}>
                    <Td>
                      <Link href={`/admin/plantillas/${p.tipo}`} className="font-medium underline-offset-2 hover:underline">
                        {p.nombre}
                      </Link>
                      {p.descripcion && <p className="mt-0.5 max-w-md text-xs text-gris-medio">{p.descripcion}</p>}
                    </Td>
                    <Td className="max-w-xs truncate text-negro/80">{p.asunto}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={p.personalizada ? 'info' : 'neutral'}>{p.personalizada ? 'Personalizada' : 'Por defecto'}</Badge>
                        {!p.activa && <Badge tone="warn">Desactivada</Badge>}
                      </div>
                    </Td>
                    <Td align="right">
                      <Link href={`/admin/plantillas/${p.tipo}`} className="text-sm underline underline-offset-2">
                        Editar
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        ))}
      </div>
    </>
  );
}
