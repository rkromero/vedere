'use client';
// Ficha del portal mayorista: galería por color, medidas, precio de la óptica, cantidades por color y
// descarga del material para vidriera y redes (ZIP con fotos en alta + ficha técnica en PDF).
import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@vedere/ui';
import { api, errorMessage } from '@/lib/api-client';
import { LABELS, formatPrecio } from '@/lib/format';
import type { AjusteStock, CarritoMayorista, ProductoMayorista } from '@/lib/mayorista';
import { textoAjuste } from '@/lib/mayorista';
import { Btn, Card } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';
import { CantidadInput, StockLabel } from './piezas';

export function FichaMayorista({ producto: p }: { producto: ProductoMayorista }) {
  const toast = useToast();
  const [varianteId, setVarianteId] = useState(p.variantes.find((v) => v.imagenes.length)?.id ?? p.variantes[0]?.id);
  const variante = p.variantes.find((v) => v.id === varianteId) ?? p.variantes[0];
  const [foto, setFoto] = useState(0);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [agregando, setAgregando] = useState(false);
  const [ajustes, setAjustes] = useState<AjusteStock[]>([]);
  const imagenes = variante?.imagenes ?? [];
  const actual = imagenes[Math.min(foto, imagenes.length - 1)];
  const unidades = Object.values(cantidades).reduce((a, c) => a + c, 0);

  async function agregar() {
    setAgregando(true);
    try {
      const r = await api.put<CarritoMayorista>('/optica/mayorista/carrito', {
        modo: 'sumar',
        items: Object.entries(cantidades)
          .filter(([, c]) => c > 0)
          .map(([id, c]) => ({ varianteId: id, cantidad: c })),
      });
      setAjustes(r.ajustes ?? []);
      setCantidades({});
      toast.ok(`Listo: ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} en el carrito (${r.unidades} en total)`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAgregando(false);
    }
  }

  const medidas = [
    ['Calibre', p.calibreMm],
    ['Puente', p.puenteMm],
    ['Varilla', p.varillaMm],
  ] as const;

  return (
    <div>
      <nav className="mb-4 text-sm text-gris-medio">
        <Link href="/optica/catalogo" className="hover:underline">
          Catálogo mayorista
        </Link>{' '}
        / <span className="text-negro">{p.nombre}</span>
      </nav>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <div className="flex aspect-[5/4] items-center justify-center overflow-hidden rounded-xl border border-negro/10 bg-blanco">
            {actual ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={actual.url} alt={actual.alt ?? `${p.nombre} ${variante?.colorArmazon}`} className="h-full w-full object-contain p-4" />
            ) : (
              <span className="text-sm text-gris-medio">Sin fotos de este color</span>
            )}
          </div>
          {imagenes.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {imagenes.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setFoto(i)}
                  aria-label={`Foto ${i + 1}`}
                  className={cn('h-16 w-20 shrink-0 overflow-hidden rounded-lg border bg-blanco', i === foto ? 'border-negro' : 'border-negro/10')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.urlMiniatura ?? img.url} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {p.variantes.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setVarianteId(v.id);
                  setFoto(0);
                }}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
                  v.id === variante?.id ? 'border-negro bg-negro text-blanco' : 'border-negro/20 bg-blanco',
                )}
              >
                <span className="h-3 w-3 rounded-full border border-negro/20" style={{ backgroundColor: v.colorArmazonHex ?? undefined }} />
                {v.colorArmazon}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{p.nombre}</h1>
            <p className="text-sm text-gris-medio">
              {[p.marca?.nombre, LABELS.linea[p.linea as keyof typeof LABELS.linea], p.coleccion?.nombre].filter(Boolean).join(' · ')}
            </p>
          </div>

          <Card>
            <dl className="space-y-1.5 text-sm" data-testid="ficha-precios">
              <div className="flex justify-between gap-4">
                <dt className="text-gris-medio">Tu precio (sin IVA)</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatPrecio(p.precio.unitario)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gris-medio">IVA {p.precio.ivaPct}%</dt>
                <dd className="tabular-nums">{formatPrecio(p.precio.iva)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gris-medio">Con IVA</dt>
                <dd className="tabular-nums">{formatPrecio(p.precio.conIva)}</dd>
              </div>
              {p.precio.descuentoPct > 0 && (
                <div className="flex justify-between gap-4 text-xs text-gris-medio">
                  <dt>Lista mayorista · tu descuento</dt>
                  <dd className="tabular-nums">
                    {formatPrecio(p.precio.lista)} · {p.precio.descuentoPct}%
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-negro/10 pt-2">
                <dt className="text-gris-medio">Precio sugerido al público</dt>
                <dd className="tabular-nums">{formatPrecio(p.precio.sugerido)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gris-medio">Ganancia estimada por unidad</dt>
                <dd className={cn('tabular-nums', p.precio.ganancia < 0 && 'text-carey')}>
                  {formatPrecio(p.precio.ganancia)}
                  {p.precio.margenPct !== null && ` (${p.precio.margenPct}%)`}
                </dd>
              </div>
            </dl>
          </Card>

          <Card title="Cantidades por color">
            <ul className="divide-y divide-negro/5">
              {p.variantes.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="h-4 w-4 shrink-0 rounded-full border border-negro/20" style={{ backgroundColor: v.colorArmazonHex ?? undefined }} />
                  <span className="min-w-0 flex-1">
                    {v.colorArmazon}
                    {v.colorLente && <span className="text-gris-medio"> · lente {v.colorLente}</span>}
                    <span className="block font-mono text-[11px] text-gris-medio">{v.sku}</span>
                  </span>
                  <StockLabel disponible={v.disponible} />
                  <CantidadInput
                    value={cantidades[v.id] ?? 0}
                    max={v.disponible}
                    onChange={(c) => setCantidades((prev) => ({ ...prev, [v.id]: c }))}
                    label={`Cantidad ${v.colorArmazon}`}
                  />
                </li>
              ))}
            </ul>
            {ajustes.length > 0 && (
              <ul role="status" className="mt-3 list-disc rounded-lg bg-sol/25 py-2 pl-8 pr-3 text-xs">
                {ajustes.map((a) => (
                  <li key={a.varianteId}>{textoAjuste(a)}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Link href="/optica/carrito" className="text-sm underline underline-offset-2">
                Ver carrito
              </Link>
              <Btn onClick={agregar} disabled={unidades === 0} loading={agregando} data-testid="ficha-agregar">
                Agregar {unidades > 0 ? `${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}` : 'al carrito'}
              </Btn>
            </div>
          </Card>

          <Card title="Medidas y características">
            <dl className="grid grid-cols-3 gap-3 text-center text-sm">
              {medidas.map(([k, v]) => (
                <div key={k} className="rounded-lg bg-gris-claro/60 px-2 py-3">
                  <dt className="text-xs text-gris-medio">{k}</dt>
                  <dd className="font-semibold">{v ? `${v} mm` : '—'}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-gris-medio">
              {[
                p.forma && LABELS.forma[p.forma as keyof typeof LABELS.forma],
                p.material && LABELS.material[p.material as keyof typeof LABELS.material],
                LABELS.genero[p.genero as keyof typeof LABELS.genero],
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {p.descripcion && <p className="mt-3 text-sm">{p.descripcion}</p>}
          </Card>

          <Card title="Para tu vidriera y tus redes">
            <p className="mb-3 text-sm text-gris-medio">
              Fotos en alta (JPG) de todos los colores y la ficha técnica con el precio sugerido al público.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/optica/mayorista/productos/${p.slug}/kit.zip`}
                className="inline-flex h-10 items-center rounded-lg bg-negro px-4 text-sm font-medium text-blanco hover:bg-negro/85"
                data-testid="descargar-zip"
              >
                Descargar fotos y ficha (ZIP)
              </a>
              <a
                href={`/api/optica/mayorista/productos/${p.slug}/ficha.pdf`}
                className="inline-flex h-10 items-center rounded-lg border border-negro/20 bg-blanco px-4 text-sm font-medium hover:bg-gris-claro"
              >
                Sólo la ficha (PDF)
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
