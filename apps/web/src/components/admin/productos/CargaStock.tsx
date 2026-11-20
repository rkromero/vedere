'use client';
// Estación de carga de stock: se escanea cada anteojo que entra.
//  - Si el código ya está cargado: suma unidades a esa variante (automático o confirmando).
//  - Si no: muestra lo que se encontró en bases públicas (datos + fotos) y ofrece crear el producto
//    o agregarlo como un color nuevo de un producto existente; el formulario se completa solo.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api-client';
import { LABELS } from '@/lib/format';
import type { Paged, Producto, ResultadoCodigo, Variante } from '@/lib/types';
import {
  Badge,
  Btn,
  Card,
  Checkbox,
  Field,
  Input,
  LinkBtn,
  PageHeader,
  Spinner,
} from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';
import { beep, CamaraCodigo, CampoCodigo } from './LectorCodigo';
import { buscarCodigo } from './escaneo';

interface Movimiento {
  id: number;
  varianteId: string;
  productoId: string;
  descripcion: string;
  cantidad: number;
  stockFinal: number;
  deshecho?: boolean;
}

let movSeq = 0;

export function CargaStock() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [camara, setCamara] = useState(false);
  const [auto, setAuto] = useState(true);
  const [cantidad, setCantidad] = useState('1');
  const [buscando, setBuscando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCodigo | null>(null);
  const [sumando, setSumando] = useState(false);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);

  const enfocar = () => setTimeout(() => inputRef.current?.focus(), 0);
  const unidades = Math.max(1, Math.floor(Number(cantidad) || 1));

  async function sumar(r: ResultadoCodigo, n: number) {
    const e = r.existente!;
    setSumando(true);
    try {
      const v = await api.post<Variante>(`/admin/variantes/${e.varianteId}/stock`, { cantidad: n });
      setMovimientos((m) => [
        {
          id: ++movSeq,
          varianteId: e.varianteId,
          productoId: e.productoId,
          descripcion: `${e.productoNombre} · ${e.colorArmazon}`,
          cantidad: n,
          stockFinal: v.stock,
        },
        ...m,
      ]);
      setResultado({ ...r, existente: { ...e, stock: v.stock } });
      beep();
      toast.ok(`+${n} ${e.productoNombre} (${e.colorArmazon}) · stock ${v.stock}`);
    } catch (err) {
      beep(false);
      toast.error(errorMessage(err));
    } finally {
      setSumando(false);
      enfocar();
    }
  }

  async function leer(codigo: string) {
    if (buscando) return;
    setBuscando(codigo);
    try {
      const r = await buscarCodigo(codigo);
      setResultado(r);
      r.avisos.forEach((a) => toast.error(a));
      if (r.existente) {
        if (auto) await sumar(r, unidades);
        else beep();
      } else {
        beep(false);
      }
    } catch (err) {
      beep(false);
      toast.error(errorMessage(err));
    } finally {
      setBuscando(null);
      enfocar();
    }
  }

  async function deshacer(m: Movimiento) {
    try {
      const v = await api.post<Variante>(`/admin/variantes/${m.varianteId}/stock`, {
        cantidad: -m.cantidad,
      });
      setMovimientos((l) =>
        l.map((x) => (x.id === m.id ? { ...x, deshecho: true, stockFinal: v.stock } : x)),
      );
      setResultado((r) =>
        r?.existente?.varianteId === m.varianteId
          ? { ...r, existente: { ...r.existente, stock: v.stock } }
          : r,
      );
      toast.ok(`Deshecho: ${m.descripcion} · stock ${v.stock}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const totalSesion = movimientos.filter((m) => !m.deshecho).reduce((a, m) => a + m.cantidad, 0);

  return (
    <div>
      <div className="mb-2 text-sm">
        <Link href="/admin/productos" className="text-gris-medio hover:text-negro">
          ← Productos
        </Link>
      </div>
      <PageHeader
        title="Cargar stock"
        description="Escaneá cada anteojo que entra. Si ya existe, suma stock; si es nuevo, buscamos sus datos y fotos para darlo de alta."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Lector">
            <div className="space-y-4">
              <CampoCodigo
                onCodigo={(c) => void leer(c)}
                inputRef={inputRef}
                disabled={buscando !== null}
              />
              {camara ? (
                <>
                  <CamaraCodigo
                    onCodigo={(c) => void leer(c)}
                    pausada={buscando !== null || sumando}
                  />
                  <Btn variant="ghost" size="sm" onClick={() => setCamara(false)}>
                    Apagar cámara
                  </Btn>
                </>
              ) : (
                <Btn variant="secondary" className="w-full" onClick={() => setCamara(true)}>
                  Usar la cámara
                </Btn>
              )}
              <div className="grid grid-cols-2 items-end gap-3 border-t border-negro/10 pt-4">
                <Field label="Unidades por escaneo">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                  />
                </Field>
                <div className="pb-2">
                  <Checkbox
                    label="Sumar automáticamente"
                    checked={auto}
                    onChange={(e) => setAuto(e.target.checked)}
                  />
                </div>
              </div>
              {buscando && (
                <p className="flex items-center gap-2 text-sm text-gris-medio" role="status">
                  <Spinner className="h-4 w-4" /> Buscando {buscando}…
                </p>
              )}
            </div>
          </Card>

          <Card title={`Cargados en esta sesión${totalSesion ? ` · ${totalSesion} u.` : ''}`}>
            {movimientos.length === 0 ? (
              <p className="text-sm text-gris-medio">Todavía no escaneaste nada.</p>
            ) : (
              <ul className="divide-y divide-negro/10 text-sm">
                {movimientos.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <div className={m.deshecho ? 'text-gris-medio line-through' : ''}>
                      <Link href={`/admin/productos/${m.productoId}`} className="hover:underline">
                        {m.descripcion}
                      </Link>
                      <span className="ml-2 text-xs text-gris-medio">
                        +{m.cantidad} → stock {m.stockFinal}
                      </span>
                    </div>
                    {!m.deshecho && (
                      <Btn variant="ghost" size="sm" onClick={() => void deshacer(m)}>
                        Deshacer
                      </Btn>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="lg:col-span-3">
          {!resultado ? (
            <div className="flex h-full min-h-48 items-center justify-center rounded-xl border border-dashed border-negro/20 px-6 py-14 text-center text-sm text-gris-medio">
              Escaneá un código para empezar.
            </div>
          ) : resultado.existente ? (
            <Existente
              r={resultado}
              unidades={unidades}
              sumando={sumando}
              onSumar={(n) => void sumar(resultado, n)}
            />
          ) : (
            <Nuevo r={resultado} />
          )}
        </div>
      </div>
    </div>
  );
}

function Existente({
  r,
  unidades,
  sumando,
  onSumar,
}: {
  r: ResultadoCodigo;
  unidades: number;
  sumando: boolean;
  onSumar: (n: number) => void;
}) {
  const e = r.existente!;
  return (
    <Card title="Ya está en el catálogo" actions={<Badge tone="ok">Encontrado</Badge>}>
      <div className="flex gap-4">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-gris-claro">
          {e.imagen && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.imagen} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold">{e.productoNombre}</p>
          <p className="text-sm text-gris-medio">
            {[e.marca, e.colorArmazon, e.colorLente && `lente ${e.colorLente}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="font-mono text-xs text-gris-medio">
            {e.sku} · {r.codigo}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-2xl font-semibold tabular-nums">{e.stock}</span>
            <span className="text-sm text-gris-medio">en stock</span>
            {e.stock < e.stockMinimo && <Badge tone="warn">Bajo mínimo ({e.stockMinimo})</Badge>}
            {!e.activa && <Badge tone="neutral">Variante inactiva</Badge>}
            {e.productoEstado !== 'PUBLICADO' && (
              <Badge tone="neutral">{LABELS.estado[e.productoEstado]}</Badge>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Btn onClick={() => onSumar(unidades)} loading={sumando}>
          Sumar {unidades}
        </Btn>
        <LinkBtn href={`/admin/productos/${e.productoId}`} variant="secondary">
          Ver producto
        </LinkBtn>
      </div>
    </Card>
  );
}

function Nuevo({ r }: { r: ResultadoCodigo }) {
  const s = r.sugerencia;
  const codigo = encodeURIComponent(r.codigo);
  const [buscarProducto, setBuscarProducto] = useState(false);

  return (
    <Card
      title={s ? 'Anteojo nuevo: encontramos estos datos' : 'Código nuevo'}
      actions={s ? <Badge tone="neutral">{s.fuente}</Badge> : <Badge tone="warn">Sin datos</Badge>}
    >
      {s ? (
        <div className="space-y-4">
          {s.imagenes.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {s.imagenes.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={u}
                  src={u}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-28 w-28 shrink-0 rounded-lg bg-gris-claro object-contain"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ))}
            </div>
          )}
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Dato k="Nombre" v={s.nombre} />
            <Dato k="Marca" v={s.marca} />
            <Dato k="Modelo" v={s.modelo} />
            <Dato k="Línea" v={s.linea && LABELS.linea[s.linea]} />
            <Dato
              k="Color"
              v={[s.colorArmazon, s.colorLente && `lente ${s.colorLente}`]
                .filter(Boolean)
                .join(' · ')}
            />
            <Dato k="Forma" v={s.forma && LABELS.forma[s.forma]} />
            <Dato k="Material" v={s.material && LABELS.material[s.material]} />
            <Dato
              k="Medidas"
              v={
                [s.calibreMm, s.puenteMm, s.varillaMm].some(Boolean)
                  ? [s.calibreMm, s.puenteMm, s.varillaMm].map((x) => x ?? '–').join(' / ')
                  : null
              }
            />
            <Dato k="Código" v={r.codigo} mono />
          </dl>
          <p className="text-xs text-gris-medio">
            Al crear, se completan estos datos y se importan las fotos. Revisalos y cargá el precio
            antes de publicar.
          </p>
        </div>
      ) : (
        <p className="text-sm text-gris-medio">
          No encontramos datos públicos para <span className="font-mono">{r.codigo}</span>. Podés
          darlo de alta igual: el código y el SKU se cargan solos y el resto lo completás a mano.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {s ? (
          <LinkBtn href={`/admin/productos/nuevo?codigo=${codigo}`}>Crear producto</LinkBtn>
        ) : (
          <>
            <LinkBtn href={`/admin/productos/nuevo?codigo=${codigo}&foto=1`}>Crear con foto de la patilla</LinkBtn>
            <LinkBtn href={`/admin/productos/nuevo?codigo=${codigo}`} variant="secondary">
              Crear a mano
            </LinkBtn>
          </>
        )}
        <Btn variant="secondary" onClick={() => setBuscarProducto((b) => !b)}>
          Es otro color de un producto existente
        </Btn>
      </div>
      {buscarProducto && (
        <ElegirProducto codigo={r.codigo} sugerido={s?.modelo ?? s?.nombre ?? ''} />
      )}
    </Card>
  );
}

function Dato({ k, v, mono }: { k: string; v: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-negro/5 pb-1">
      <dt className="text-gris-medio">{k}</dt>
      <dd className={mono ? 'font-mono text-xs' : 'text-right'}>{v || '—'}</dd>
    </div>
  );
}

function ElegirProducto({ codigo, sugerido }: { codigo: string; sugerido: string }) {
  const [q, setQ] = useState(sugerido);
  const [items, setItems] = useState<Producto[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim().length < 2) return setItems(null);
      api
        .get<Paged<Producto>>(`/admin/productos?pageSize=8&q=${encodeURIComponent(q.trim())}`)
        .then((r) => setItems(r.items))
        .catch(() => setItems([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mt-4 space-y-2 rounded-lg bg-gris-claro p-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar producto por nombre o SKU"
        autoFocus
      />
      {items && items.length === 0 && <p className="text-xs text-gris-medio">Sin resultados.</p>}
      {items && items.length > 0 && (
        <ul className="divide-y divide-negro/10 rounded-lg bg-blanco text-sm">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/productos/${p.id}?codigo=${encodeURIComponent(codigo)}`}
                className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-gris-claro"
              >
                <span>{p.nombre}</span>
                <span className="text-xs text-gris-medio">
                  {p.variantes.length} color{p.variantes.length === 1 ? '' : 'es'} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
