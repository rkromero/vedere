'use client';
// Reportes de ventas (prompt 6): filtros por fecha con presets, totales, barras por día (SVG), tablas por
// estado / línea / óptica / colección / código de creador, más vendidos y exportación CSV.
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Badge, Btn, Card, EmptyState, Field, Input, PageHeader } from '@/components/admin/ui';
import { Table, Td, Th, Tr, useQueryParams } from '@/components/admin/table';
import { formatPrecio } from '@/lib/format';
import { ESTADO_PEDIDO_LABEL, estadoPedidoTone } from '@/lib/pedidos';
import type { EstadoPedido } from '@/lib/pedidos';
import type { Reporte, ReporteAgrupado, ReporteDia } from '@/lib/admin/prompt6';
import { fechaISO } from '@/lib/admin/prompt6';

interface Props {
  reporte: Reporte | null;
  desde: string;
  hasta: string;
  csvPedidosHref: string;
  csvItemsHref: string;
}

const PRESETS: Array<{ label: string; desde: () => string; hasta: () => string }> = [
  { label: 'Hoy', desde: () => fechaISO(0), hasta: () => fechaISO(0) },
  { label: '7 días', desde: () => fechaISO(-6), hasta: () => fechaISO(0) },
  { label: '30 días', desde: () => fechaISO(-29), hasta: () => fechaISO(0) },
  { label: 'Este mes', desde: () => `${fechaISO(0).slice(0, 7)}-01`, hasta: () => fechaISO(0) },
  { label: '90 días', desde: () => fechaISO(-89), hasta: () => fechaISO(0) },
];

function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function pct(n: number): string {
  return `${(Math.round(n * 10) / 10).toLocaleString('es-AR')}%`;
}

export function ReportesView({ reporte, desde, hasta, csvPedidosHref, csvItemsHref }: Props) {
  const { set } = useQueryParams();
  const [rango, setRango] = useState({ desde, hasta });

  function aplicar(e: FormEvent) {
    e.preventDefault();
    set({ desde: rango.desde, hasta: rango.hasta });
  }

  function preset(p: (typeof PRESETS)[number]) {
    const r = { desde: p.desde(), hasta: p.hasta() };
    setRango(r);
    set(r);
  }

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Ventas pagadas por período, ticket promedio, conversión y desglose por estado, línea, óptica, colección y código de creador."
        actions={
          <>
            <a href={csvPedidosHref} className="inline-flex h-10 items-center rounded-lg border border-negro/20 bg-blanco px-4 text-sm font-medium hover:bg-gris-claro">
              CSV pedidos
            </a>
            <a href={csvItemsHref} className="inline-flex h-10 items-center rounded-lg border border-negro/20 bg-blanco px-4 text-sm font-medium hover:bg-gris-claro">
              CSV ítems
            </a>
          </>
        }
      />

      <Card className="mb-6">
        <form onSubmit={aplicar} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Desde">
              <Input type="date" value={rango.desde} max={rango.hasta} onChange={(e) => setRango({ ...rango, desde: e.target.value })} required />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={rango.hasta} min={rango.desde} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} required />
            </Field>
            <Btn type="submit" variant="secondary">
              Aplicar
            </Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const activo = p.desde() === desde && p.hasta() === hasta;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => preset(p)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${activo ? 'border-negro bg-negro text-blanco' : 'border-negro/20 bg-blanco hover:bg-gris-claro'}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </form>
      </Card>

      {!reporte ? (
        <EmptyState
          title="No se pudo consultar el reporte"
          description="La API no respondió a /admin/reportes. Revisá que el servicio esté actualizado y volvé a intentar."
        />
      ) : (
        <ReporteContenido reporte={reporte} />
      )}
    </>
  );
}

function ReporteContenido({ reporte }: { reporte: Reporte }) {
  const t = reporte.totales;
  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ventas del período" value={formatPrecio(t.ventas)} hint={`${t.pedidos} pedidos pagados`} />
        <Stat label="Ticket promedio" value={formatPrecio(t.ticketPromedio)} />
        <Stat
          label="Conversión"
          value={pct(t.conversion.pct)}
          hint={`${t.conversion.pedidosPagados} pagados de ${t.conversion.carritos} carritos y pedidos`}
        />
        <Stat label="Hoy · semana · mes" value={formatPrecio(reporte.hoy.ventas)} hint={`${formatPrecio(reporte.semana.ventas)} · ${formatPrecio(reporte.mes.ventas)}`} />
      </div>

      <Card title="Ventas por día" className="mb-6">
        <BarrasPorDia dias={reporte.porDia} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Pedidos por estado">
          {reporte.porEstado.length === 0 ? (
            <Vacio />
          ) : (
            <Table className="border-0">
              <thead>
                <tr>
                  <Th>Estado</Th>
                  <Th align="right">Pedidos</Th>
                  <Th align="right">Ventas</Th>
                </tr>
              </thead>
              <tbody>
                {reporte.porEstado.map((e) => (
                  <Tr key={e.estado}>
                    <Td>
                      <Badge tone={estadoPedidoTone(e.estado as EstadoPedido)}>
                        {ESTADO_PEDIDO_LABEL[e.estado as EstadoPedido] ?? e.estado}
                      </Badge>
                    </Td>
                    <Td align="right">{e.cantidad}</Td>
                    <Td align="right">{formatPrecio(e.ventas)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="Más vendidos">
          {reporte.masVendidos.length === 0 ? (
            <Vacio />
          ) : (
            <Table className="border-0">
              <thead>
                <tr>
                  <Th>Producto</Th>
                  <Th align="right">Unidades</Th>
                  <Th align="right">Ventas</Th>
                </tr>
              </thead>
              <tbody>
                {reporte.masVendidos.map((p) => (
                  <Tr key={p.productoId}>
                    <Td>
                      <Link href={`/admin/productos/${p.productoId}`} className="font-medium underline-offset-2 hover:underline">
                        {p.nombre}
                      </Link>
                    </Td>
                    <Td align="right">{p.unidades}</Td>
                    <Td align="right">{formatPrecio(p.ventas)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Agrupado titulo="Ventas por línea" filas={reporte.porLinea} total={t.ventas} unidades />
        <Agrupado titulo="Ventas por óptica" filas={reporte.porOptica} total={t.ventas} />
        <Agrupado titulo="Ventas por colección" filas={reporte.porColeccion} total={t.ventas} unidades />
        <Agrupado titulo="Ventas por código de creador" filas={reporte.porCreador} total={t.ventas} />
      </div>

      <p className="mt-6 text-xs text-gris-medio">
        Ventas = total de pedidos con pago aprobado (sin cancelados ni devueltos) según la fecha de pago. Conversión =
        pedidos pagados ÷ (carritos con productos tocados en el período + pedidos creados en el período).
      </p>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-negro/10 bg-blanco p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gris-medio">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-gris-medio">{hint}</p>}
    </div>
  );
}

function Vacio() {
  return <p className="text-sm text-gris-medio">Sin datos en el período.</p>;
}

function Agrupado({
  titulo,
  filas,
  total,
  unidades,
}: {
  titulo: string;
  filas: ReporteAgrupado[];
  total: number;
  unidades?: boolean;
}) {
  return (
    <Card title={titulo}>
      {filas.length === 0 ? (
        <Vacio />
      ) : (
        <ul className="space-y-3">
          {filas.map((f) => {
            const share = total > 0 ? Math.min(100, (f.ventas / total) * 100) : 0;
            return (
              <li key={f.clave}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{f.nombre}</span>
                  <span className="shrink-0 tabular-nums">
                    {formatPrecio(f.ventas)}{' '}
                    <span className="text-xs text-gris-medio">
                      · {unidades ? `${f.unidades ?? 0} u.` : `${f.pedidos ?? 0} ped.`} · {pct(share)}
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gris-claro">
                  <div className="h-full rounded-full bg-negro" style={{ width: `${share}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Barras por día en SVG puro: alto fijo, ancho fluido, tooltips nativos con <title>. */
function BarrasPorDia({ dias }: { dias: ReporteDia[] }) {
  if (dias.length === 0) return <Vacio />;
  const max = Math.max(...dias.map((d) => d.ventas), 1);
  const H = 160;
  const W = 100; // viewBox en porcentaje
  const gap = 0.25;
  const bw = W / dias.length;
  const labelCada = Math.max(1, Math.ceil(dias.length / 10));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} preserveAspectRatio="none" className="h-56 w-full" role="img" aria-label="Ventas por día">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={H - H * f} y2={H - H * f} stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.2" vectorEffect="non-scaling-stroke" />
        ))}
        {dias.map((d, i) => {
          const h = (d.ventas / max) * H;
          return (
            <g key={d.fecha}>
              <rect x={i * bw + gap / 2} y={H - h} width={Math.max(bw - gap, 0.2)} height={h} fill="#0A0A0A" rx="0" opacity={d.ventas === 0 ? 0.15 : 1}>
                <title>{`${fechaCorta(d.fecha)}: ${formatPrecio(d.ventas)} · ${d.pedidos} pedidos`}</title>
              </rect>
              {i % labelCada === 0 && (
                <text x={i * bw + bw / 2} y={H + 12} fontSize="3.2" textAnchor="middle" fill="#8A8A86" style={{ fontFamily: 'inherit' }}>
                  {fechaCorta(d.fecha)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-gris-medio">
        <span>Máximo diario: {formatPrecio(max)}</span>
        <span>{dias.length} días</span>
      </div>
    </div>
  );
}
