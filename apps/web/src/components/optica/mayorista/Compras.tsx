'use client';
// Mis compras mayoristas: listado con estado y detalle con "Repetir pedido" (carga el carrito ajustando
// por stock y avisa las variantes que no se pudieron agregar).
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api-client';
import { formatFecha, formatPrecio } from '@/lib/format';
import type { CarritoMayorista, PedidoMayorista } from '@/lib/mayorista';
import { AJUSTES_KEY, ENTREGA_LABEL, ESTADO_MAYORISTA } from '@/lib/mayorista';
import type { Paged } from '@/components/admin/table';
import { FilterSelect, Pagination, SearchInput, Table, Td, Th, Toolbar, Tr } from '@/components/admin/table';
import { Badge, Btn, Card, EmptyState, LinkBtn, PageHeader } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';

export function ComprasTable({ data }: { data: Paged<PedidoMayorista> }) {
  return (
    <>
      <PageHeader
        title="Mis compras"
        description="Los pedidos mayoristas de tu óptica a Vedere."
        actions={<LinkBtn href="/optica/catalogo">Nuevo pedido</LinkBtn>}
      />
      <Toolbar>
        <SearchInput placeholder="Número o SKU…" />
        <FilterSelect
          param="estado"
          label="Estado"
          options={Object.entries(ESTADO_MAYORISTA).map(([value, e]) => ({ value, label: e.label }))}
        />
      </Toolbar>
      {data.items.length === 0 ? (
        <EmptyState
          title="Todavía no hay compras"
          description="Cuando confirmes un pedido desde el carrito mayorista lo vas a ver acá."
          action={<LinkBtn href="/optica/catalogo">Ver catálogo</LinkBtn>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Pedido</Th>
              <Th>Fecha</Th>
              <Th>Estado</Th>
              <Th>Entrega</Th>
              <Th align="right">Unidades</Th>
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <Link href={`/optica/compras/${p.id}`} className="font-medium hover:underline">
                    {p.numero}
                  </Link>
                  <span className="block text-xs text-gris-medio">{p.usuarioNombre}</span>
                </Td>
                <Td>{formatFecha(p.createdAt)}</Td>
                <Td>
                  <Badge tone={ESTADO_MAYORISTA[p.estado].tone}>{ESTADO_MAYORISTA[p.estado].label}</Badge>
                </Td>
                <Td>{ENTREGA_LABEL[p.entrega]}</Td>
                <Td align="right">{p.unidades}</Td>
                <Td align="right">{formatPrecio(p.total)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} />
    </>
  );
}

export function CompraDetalle({ pedido: p, nuevo }: { pedido: PedidoMayorista; nuevo: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [repitiendo, setRepitiendo] = useState(false);

  async function repetir() {
    setRepitiendo(true);
    try {
      const r = await api.post<CarritoMayorista>(`/optica/mayorista/pedidos/${p.id}/repetir`);
      try {
        if (r.ajustes?.length) sessionStorage.setItem(AJUSTES_KEY, JSON.stringify(r.ajustes));
      } catch {
        /* sin sessionStorage */
      }
      toast.ok(r.ajustes?.length ? 'Cargamos el pedido; algunos modelos no tienen stock' : 'Cargamos el pedido en el carrito');
      router.push(`/optica/carrito?repetido=${p.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setRepitiendo(false);
    }
  }

  const e = ESTADO_MAYORISTA[p.estado];
  return (
    <>
      <nav className="mb-4 text-sm text-gris-medio">
        <Link href="/optica/compras" className="hover:underline">
          Mis compras
        </Link>{' '}
        / <span className="text-negro">{p.numero}</span>
      </nav>
      {nuevo && (
        <div role="status" className="mb-4 rounded-lg bg-[#2f7d4f]/10 px-4 py-3 text-sm text-[#2f7d4f]" data-testid="pedido-confirmado">
          ¡Listo! Recibimos el pedido <strong>{p.numero}</strong>. Queda pendiente de aprobación: te avisamos cuando lo aprobemos.
        </div>
      )}
      <PageHeader
        title={`Pedido ${p.numero}`}
        description={`Hecho el ${formatFecha(p.createdAt, true)} por ${p.usuarioNombre}`}
        actions={
          <Btn onClick={repetir} loading={repitiendo} data-testid="repetir-pedido">
            Repetir pedido
          </Btn>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card title="Modelos">
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm" data-testid="compra-items">
              <thead className="border-b border-negro/10 text-left text-xs uppercase tracking-wide text-gris-medio">
                <tr>
                  <th className="px-5 py-2 font-medium">Modelo</th>
                  <th className="px-3 py-2 text-right font-medium">Precio s/IVA</th>
                  <th className="px-3 py-2 text-right font-medium">Cant.</th>
                  <th className="px-5 py-2 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-negro/5">
                {p.items.map((i) => (
                  <tr key={i.id}>
                    <td className="px-5 py-2">
                      <span className="font-medium">{i.nombre}</span>
                      <span className="block text-xs text-gris-medio">
                        {i.color} · <span className="font-mono">{i.sku}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatPrecio(i.precioUnitario)}
                      {i.descuentoPct > 0 && <span className="block text-xs text-gris-medio">lista {formatPrecio(i.precioMayorista)}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.cantidad}</td>
                    <td className="px-5 py-2 text-right font-medium tabular-nums">{formatPrecio(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Estado">
            <Badge tone={e.tone}>{e.label}</Badge>
            <ul className="mt-3 space-y-1 text-sm text-gris-medio">
              <li>Recibido: {formatFecha(p.createdAt, true)}</li>
              {p.aprobadoEn && <li>Aprobado: {formatFecha(p.aprobadoEn, true)}</li>}
              {p.despachadoEn && (
                <li>
                  Despachado: {formatFecha(p.despachadoEn, true)}
                  {p.numeroSeguimiento && ` · seguimiento ${p.numeroSeguimiento}`}
                </li>
              )}
              {p.entregadoEn && <li>Entregado: {formatFecha(p.entregadoEn, true)}</li>}
              {p.canceladoEn && (
                <li className="text-carey">
                  Cancelado: {formatFecha(p.canceladoEn, true)}
                  {p.motivoCancelacion && ` · ${p.motivoCancelacion}`}
                </li>
              )}
            </ul>
          </Card>
          <Card title="Entrega">
            <p className="text-sm font-medium">{ENTREGA_LABEL[p.entrega]}</p>
            <p className="text-sm text-gris-medio">{p.direccionEntrega}</p>
            {p.envioACargoOptica && <p className="mt-1 text-xs">El flete lo paga la óptica al recibir.</p>}
            {p.notas && <p className="mt-2 text-sm">Notas: {p.notas}</p>}
          </Card>
          <Card title="Importes">
            <dl className="space-y-1.5 text-sm" data-testid="compra-totales">
              <Fila k={`${p.unidades} unidades a lista`} v={formatPrecio(p.subtotalLista)} />
              {p.descuento > 0 && <Fila k={`Descuento (${p.descuentoPct}%)`} v={`− ${formatPrecio(p.descuento)}`} />}
              <Fila k="Subtotal sin IVA" v={formatPrecio(p.subtotal)} />
              {p.envio > 0 && <Fila k="Envío" v={formatPrecio(p.envio)} />}
              <Fila k={`IVA ${p.ivaPct}%`} v={formatPrecio(p.iva)} />
              <div className="border-t border-negro/10 pt-2 font-semibold">
                <Fila k="Total" v={formatPrecio(p.total)} />
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
