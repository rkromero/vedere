'use client';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@vedere/ui';
import { ApiError, api, errorMessage } from '@/lib/api-client';
import { LABELS, formatFecha, options } from '@/lib/format';
import type { EstadoProducto, Forma, Genero, Linea, Material } from '@/lib/format';
import type { Categoria, Coleccion, Marca, Producto } from '@/lib/types';
import {
  Badge,
  Btn,
  Card,
  Checkbox,
  ConfirmDialog,
  Field,
  Input,
  PageHeader,
  Select,
  Tabs,
  Textarea,
  estadoTone,
} from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';
import { calcularMargen, estadoInicial, productoPayload, slugify, variantePayload } from './form-types';
import type { ProductoFormState, VarianteForm } from './form-types';
import { VariantesTab } from './VariantesTab';
import { ImagenesTab } from './ImagenesTab';
import { SeoTab } from './SeoTab';

type Tab = 'datos' | 'variantes' | 'imagenes' | 'seo';

const LINEAS = options(LABELS.linea);
const MATERIALES = options(LABELS.material);
const FORMAS = options(LABELS.forma);
const GENEROS = options(LABELS.genero);
const ESTADOS = options(LABELS.estado);

const CAMPOS_SEO = new Set(['seoTitle', 'seoDescription']);

/** Decide a qué pestaña corresponde un error por campo. */
function tabDeCampo(campo: string): Tab {
  if (campo.startsWith('variantes.')) {
    return campo.includes('.imagenes') ? 'imagenes' : 'variantes';
  }
  if (CAMPOS_SEO.has(campo)) return 'seo';
  return 'datos';
}

/** Validación mínima en cliente para dar feedback antes de pegarle a la API. */
function validar(s: ProductoFormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!s.nombre.trim()) e.nombre = 'Ingresá el nombre del producto';
  if (s.precio.trim() === '' || Number.isNaN(Number(s.precio)) || Number(s.precio) < 0) {
    e.precio = 'Ingresá un precio válido';
  }
  if (
    s.precioMayorista.trim() !== '' &&
    (Number.isNaN(Number(s.precioMayorista)) || Number(s.precioMayorista) < 0)
  ) {
    e.precioMayorista = 'Ingresá un precio mayorista válido';
  }
  if (s.precioLista.trim() !== '' && Number(s.precioLista) < Number(s.precio)) {
    e.precioLista = 'El precio de lista debería ser mayor o igual al precio de venta';
  }
  const skus = new Map<string, number>();
  s.variantes.forEach((v, i) => {
    if (!v.colorArmazon.trim()) e[`variantes.${i}.colorArmazon`] = 'Ingresá el color de armazón';
    const sku = v.sku.trim().toUpperCase();
    if (!sku) {
      e[`variantes.${i}.sku`] = 'Ingresá el SKU';
    } else if (skus.has(sku)) {
      e[`variantes.${i}.sku`] = `SKU repetido en este producto (variante ${skus.get(sku)! + 1})`;
    } else {
      skus.set(sku, i);
    }
    if (Number(v.stock || 0) < 0) e[`variantes.${i}.stock`] = 'El stock no puede ser negativo';
  });
  return e;
}

export function ProductoForm({
  producto,
  marcas,
  categorias,
  colecciones,
}: {
  producto: Producto | null;
  marcas: Marca[];
  categorias: Categoria[];
  colecciones: Coleccion[];
}) {
  const router = useRouter();
  const toast = useToast();
  const esEdicion = producto !== null;

  const [state, setState] = useState<ProductoFormState>(() => estadoInicial(producto));
  const [tab, setTab] = useState<Tab>('datos');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [variantesEliminadas, setVariantesEliminadas] = useState<string[]>([]);

  const patch = (p: Partial<ProductoFormState>) => setState((s) => ({ ...s, ...p }));

  function setNombre(nombre: string) {
    setState((s) => ({ ...s, nombre, slug: s.slugManual ? s.slug : slugify(nombre) }));
  }

  function toggleCategoria(id: string, checked: boolean) {
    setState((s) => ({
      ...s,
      categoriaIds: checked
        ? Array.from(new Set([...s.categoriaIds, id]))
        : s.categoriaIds.filter((c) => c !== id),
    }));
  }

  function quitarVariante(v: VarianteForm) {
    if (v.id) setVariantesEliminadas((ids) => [...ids, v.id!]);
    setState((s) => ({ ...s, variantes: s.variantes.filter((x) => x.key !== v.key) }));
  }

  // Árbol de categorías: padres activos con sus hijas (ordenados).
  const arbol = useMemo(() => {
    const porPadre = new Map<string | null, Categoria[]>();
    for (const c of categorias) {
      const lista = porPadre.get(c.padreId) ?? [];
      lista.push(c);
      porPadre.set(c.padreId, lista);
    }
    const ordenar = (l: Categoria[]) =>
      [...l].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
    const raices = ordenar(porPadre.get(null) ?? []);
    // Si una categoría tiene padre no presente en la lista, la tratamos como raíz.
    const idsPresentes = new Set(categorias.map((c) => c.id));
    const huerfanas = categorias.filter((c) => c.padreId && !idsPresentes.has(c.padreId));
    return [...raices, ...ordenar(huerfanas)].map((raiz) => ({
      raiz,
      hijas: ordenar(porPadre.get(raiz.id) ?? []),
    }));
  }, [categorias]);

  const errorCount = (t: Tab) => Object.keys(errors).filter((k) => tabDeCampo(k) === t).length;
  const badge = (t: Tab) =>
    errorCount(t) > 0 ? <Badge tone="danger">{errorCount(t)}</Badge> : undefined;
  const stockTotal = state.variantes.reduce((acc, v) => acc + Number(v.stock || 0), 0);
  const totalImagenes = state.variantes.reduce((acc, v) => acc + v.imagenes.length, 0);

  const tabs: Array<{ value: Tab; label: string; badge?: ReactNode }> = [
    { value: 'datos', label: 'Datos', badge: badge('datos') },
    {
      value: 'variantes',
      label: 'Variantes y stock',
      badge: badge('variantes') ?? <Badge tone="neutral">{state.variantes.length}</Badge>,
    },
    {
      value: 'imagenes',
      label: 'Imágenes',
      badge: badge('imagenes') ?? <Badge tone="neutral">{totalImagenes}</Badge>,
    },
    { value: 'seo', label: 'SEO', badge: badge('seo') },
  ];

  function aplicarErrores(fieldErrors: Record<string, string>, mensaje: string | null) {
    setErrors(fieldErrors);
    setGeneral(mensaje);
    const primero = Object.keys(fieldErrors)[0];
    if (primero) setTab(tabDeCampo(primero));
    else if (mensaje && /sku/i.test(mensaje)) setTab('variantes');
  }

  async function guardar() {
    const locales = validar(state);
    if (Object.keys(locales).length > 0) {
      aplicarErrores(locales, 'Revisá los campos marcados antes de guardar.');
      return;
    }
    setGuardando(true);
    setErrors({});
    setGeneral(null);
    try {
      if (!esEdicion) {
        const creado = await api.post<Producto>('/admin/productos', {
          ...productoPayload(state),
          variantes: state.variantes.map((v, i) => variantePayload(v, i)),
        });
        toast.ok('Producto creado');
        router.push(`/admin/productos/${creado.id}`);
        router.refresh();
        return;
      }

      const id = producto.id;
      await api.put<Producto>(`/admin/productos/${id}`, productoPayload(state));

      // Variantes eliminadas en el formulario.
      for (const vid of variantesEliminadas) {
        try {
          await api.del(`/admin/variantes/${vid}`);
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 404)) throw err;
        }
      }
      setVariantesEliminadas([]);

      // Variantes existentes y nuevas, con el índice para mapear errores a la pestaña.
      for (const [i, v] of state.variantes.entries()) {
        try {
          if (v.id) {
            await api.put(`/admin/variantes/${v.id}`, variantePayload(v, i));
          } else {
            const creada = await api.post<{ id: string }>(
              `/admin/productos/${id}/variantes`,
              variantePayload(v, i),
            );
            // Guardamos el id para que un reintento no la duplique.
            setState((s) => ({
              ...s,
              variantes: s.variantes.map((x) => (x.key === v.key ? { ...x, id: creada.id } : x)),
            }));
          }
        } catch (err) {
          if (err instanceof ApiError) {
            const fe = err.fieldErrors;
            const mapped: Record<string, string> = {};
            for (const [k, msg] of Object.entries(fe)) mapped[`variantes.${i}.${k}`] = msg;
            if (err.status === 409 || err.code === 'DUPLICATE') {
              mapped[`variantes.${i}.sku`] = err.message;
            }
            aplicarErrores(
              mapped,
              `${err.message} (variante ${i + 1}). Los datos del producto ya se guardaron.`,
            );
            toast.error(err.message);
            return;
          }
          throw err;
        }
      }

      toast.ok('Producto guardado');
      router.push(`/admin/productos/${id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        aplicarErrores(err.fieldErrors, err.message);
      } else {
        setGeneral(errorMessage(err));
      }
      toast.error(errorMessage(err));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!producto) return;
    setEliminando(true);
    try {
      await api.del(`/admin/productos/${producto.id}`);
      toast.ok('Producto eliminado');
      router.push('/admin/productos');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setEliminando(false);
      setConfirmarEliminar(false);
    }
  }

  const titulo = esEdicion ? producto.nombre : 'Nuevo producto';

  return (
    <div className="pb-24">
      <div className="mb-2 text-sm">
        <Link href="/admin/productos" className="text-gris-medio hover:text-negro">
          ← Productos
        </Link>
      </div>
      <PageHeader
        title={titulo}
        description={
          esEdicion
            ? `Slug: ${producto.slug} · Stock total ${stockTotal} · ${state.variantes.length} variante${state.variantes.length === 1 ? '' : 's'}`
            : 'Completá los datos, las variantes de color y las imágenes. Podés guardar como borrador y publicar después.'
        }
        actions={
          <>
            {esEdicion && (
              <Badge tone={estadoTone(producto.estado)}>{LABELS.estado[producto.estado]}</Badge>
            )}
            {esEdicion && (
              <Btn variant="danger" onClick={() => setConfirmarEliminar(true)} disabled={guardando}>
                Eliminar
              </Btn>
            )}
            <Btn onClick={() => void guardar()} loading={guardando}>
              {esEdicion ? 'Guardar cambios' : 'Crear producto'}
            </Btn>
          </>
        }
      />

      {general && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-carey/40 bg-carey/10 px-4 py-3 text-sm text-carey"
        >
          {general}
        </div>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'datos' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title="Información básica">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" required error={errors.nombre} className="sm:col-span-2">
                  <Input
                    value={state.nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Aviador Clásico"
                    autoFocus={!esEdicion}
                  />
                </Field>
                <Field
                  label="Slug"
                  error={errors.slug}
                  hint={
                    state.slugManual
                      ? 'Editado a mano. Dejalo vacío para regenerarlo desde el nombre.'
                      : 'Se genera automáticamente desde el nombre.'
                  }
                  className="sm:col-span-2"
                >
                  <div className="flex gap-2">
                    <Input
                      value={state.slug}
                      onChange={(e) =>
                        patch({
                          slug: slugify(e.target.value) || e.target.value.toLowerCase(),
                          slugManual: e.target.value !== '',
                        })
                      }
                      placeholder="aviador-clasico"
                      className="font-mono"
                    />
                    {state.slugManual && (
                      <Btn
                        variant="secondary"
                        onClick={() => patch({ slug: slugify(state.nombre), slugManual: false })}
                      >
                        Regenerar
                      </Btn>
                    )}
                  </div>
                </Field>
                <Field label="Descripción" error={errors.descripcion} className="sm:col-span-2">
                  <Textarea
                    value={state.descripcion}
                    onChange={(e) => patch({ descripcion: e.target.value })}
                    rows={5}
                    placeholder="Materiales, estilo, para quién es…"
                  />
                </Field>
              </div>
            </Card>

            <Card title="Características">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Línea" required error={errors.linea}>
                  <Select
                    value={state.linea}
                    onChange={(e) => patch({ linea: e.target.value as Linea })}
                  >
                    {LINEAS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Material" error={errors.material}>
                  <Select
                    value={state.material}
                    onChange={(e) => patch({ material: e.target.value as Material | '' })}
                  >
                    <option value="">Sin especificar</option>
                    {MATERIALES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Forma" error={errors.forma}>
                  <Select
                    value={state.forma}
                    onChange={(e) => patch({ forma: e.target.value as Forma | '' })}
                  >
                    <option value="">Sin especificar</option>
                    {FORMAS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Género" error={errors.genero}>
                  <Select
                    value={state.genero}
                    onChange={(e) => patch({ genero: e.target.value as Genero })}
                  >
                    {GENEROS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-negro/70">
                Medidas (mm)
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Calibre" error={errors.calibreMm} hint="Ancho de la lente">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={state.calibreMm}
                    onChange={(e) => patch({ calibreMm: e.target.value })}
                    placeholder="52"
                  />
                </Field>
                <Field label="Puente" error={errors.puenteMm}>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={state.puenteMm}
                    onChange={(e) => patch({ puenteMm: e.target.value })}
                    placeholder="18"
                  />
                </Field>
                <Field label="Varilla" error={errors.varillaMm}>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={state.varillaMm}
                    onChange={(e) => patch({ varillaMm: e.target.value })}
                    placeholder="145"
                  />
                </Field>
              </div>
            </Card>

            <Card title="Categorías">
              {arbol.length === 0 ? (
                <p className="text-sm text-gris-medio">
                  Todavía no hay categorías.{' '}
                  <Link href="/admin/categorias" className="underline">
                    Crear categorías
                  </Link>
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {arbol.map(({ raiz, hijas }) => (
                    <div key={raiz.id} className="space-y-1.5">
                      <Checkbox
                        label={
                          <span className="font-medium">
                            {raiz.nombre}
                            {!raiz.activa && (
                              <span className="ml-1 text-xs text-gris-medio">(inactiva)</span>
                            )}
                          </span>
                        }
                        checked={state.categoriaIds.includes(raiz.id)}
                        onChange={(e) => toggleCategoria(raiz.id, e.target.checked)}
                      />
                      {hijas.map((h) => (
                        <div key={h.id} className="pl-6">
                          <Checkbox
                            label={
                              <>
                                {h.nombre}
                                {!h.activa && (
                                  <span className="ml-1 text-xs text-gris-medio">(inactiva)</span>
                                )}
                              </>
                            }
                            checked={state.categoriaIds.includes(h.id)}
                            onChange={(e) => toggleCategoria(h.id, e.target.checked)}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {errors.categoriaIds && (
                <p className="mt-2 text-xs text-carey">{errors.categoriaIds}</p>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Publicación">
              <div className="space-y-4">
                <Field label="Estado" error={errors.estado}>
                  <Select
                    value={state.estado}
                    onChange={(e) => patch({ estado: e.target.value as EstadoProducto })}
                  >
                    {ESTADOS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Checkbox
                  label="Destacado en la home"
                  checked={state.destacado}
                  onChange={(e) => patch({ destacado: e.target.checked })}
                />
                <Checkbox
                  label="Permite receta (lentes graduados)"
                  checked={state.permiteReceta}
                  onChange={(e) => patch({ permiteReceta: e.target.checked })}
                />
                <Checkbox
                  label="Edición limitada (etiqueta en la tienda)"
                  checked={state.edicionLimitada}
                  onChange={(e) => patch({ edicionLimitada: e.target.checked })}
                />
                <fieldset className="space-y-2 border-t border-negro/10 pt-4">
                  <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-gris-medio">
                    Visible en
                  </legend>
                  <Checkbox
                    label="Tienda web (público)"
                    checked={state.visibleTienda}
                    onChange={(e) => patch({ visibleTienda: e.target.checked })}
                  />
                  <Checkbox
                    label="Canal mayorista (ópticas socias)"
                    checked={state.visibleMayorista}
                    onChange={(e) => patch({ visibleMayorista: e.target.checked })}
                  />
                  {!state.visibleTienda && !state.visibleMayorista && (
                    <p className="text-xs text-carey">No se ve en ningún canal.</p>
                  )}
                  {!state.visibleTienda && state.visibleMayorista && (
                    <p className="text-xs text-gris-medio">Exclusivo para ópticas: no aparece en la tienda.</p>
                  )}
                </fieldset>
                {esEdicion && producto.estado === 'PUBLICADO' && (
                  <p className="rounded-lg bg-gris-claro px-3 py-2 text-xs text-negro/80">
                    Ver en tienda:{' '}
                    <a
                      href={`/p/${producto.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono underline underline-offset-2"
                    >
                      /p/{producto.slug}
                    </a>
                  </p>
                )}
              </div>
            </Card>

            <Card title="Precios por canal">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Precio web (ARS, con IVA)" required error={errors.precio}>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={state.precio}
                      onChange={(e) => patch({ precio: e.target.value })}
                      placeholder="89900"
                    />
                  </Field>
                  <Field
                    label="Precio mayorista (ARS, sin IVA)"
                    error={errors.precioMayorista}
                    hint="Lo ven sólo las ópticas socias."
                  >
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={state.precioMayorista}
                      onChange={(e) => patch({ precioMayorista: e.target.value })}
                      placeholder="37000"
                    />
                  </Field>
                </div>
                <MargenOptica precio={state.precio} precioMayorista={state.precioMayorista} />
                <Field
                  label="Precio de lista web (ARS)"
                  error={errors.precioLista}
                  hint="Opcional. Se muestra tachado si es mayor al precio web."
                >
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={state.precioLista}
                    onChange={(e) => patch({ precioLista: e.target.value })}
                    placeholder="109900"
                  />
                </Field>
              </div>
            </Card>

            <Card title="Marca y colección">
              <div className="space-y-4">
                <Field label="Marca" error={errors.marcaId}>
                  <Select
                    value={state.marcaId}
                    onChange={(e) => patch({ marcaId: e.target.value })}
                  >
                    <option value="">Sin marca</option>
                    {marcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                        {!m.activa ? ' (inactiva)' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Colección" error={errors.coleccionId}>
                  <Select
                    value={state.coleccionId}
                    onChange={(e) => patch({ coleccionId: e.target.value })}
                  >
                    <option value="">Sin colección</option>
                    {colecciones.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                        {!c.activa ? ' (inactiva)' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>

            {esEdicion && (
              <Card title="Auditoría">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-gris-medio">Creado</dt>
                    <dd>{formatFecha(producto.createdAt, true)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gris-medio">Modificado</dt>
                    <dd>{formatFecha(producto.updatedAt, true)}</dd>
                  </div>
                  {producto.publicadoEn && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gris-medio">Publicado</dt>
                      <dd>{formatFecha(producto.publicadoEn, true)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-gris-medio">Vendidos</dt>
                    <dd>{producto.vendidos}</dd>
                  </div>
                  {producto.createdById && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gris-medio">Creado por</dt>
                      <dd className="truncate font-mono text-xs" title={producto.createdById}>
                        {producto.createdById.slice(0, 8)}…
                      </dd>
                    </div>
                  )}
                  {producto.updatedById && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gris-medio">Modificado por</dt>
                      <dd className="truncate font-mono text-xs" title={producto.updatedById}>
                        {producto.updatedById.slice(0, 8)}…
                      </dd>
                    </div>
                  )}
                </dl>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'variantes' && (
        <VariantesTab
          variantes={state.variantes}
          errors={errors}
          onChange={(variantes) => patch({ variantes })}
          onRemove={quitarVariante}
        />
      )}

      {tab === 'imagenes' && (
        <ImagenesTab variantes={state.variantes} onChange={(variantes) => patch({ variantes })} />
      )}

      {tab === 'seo' && <SeoTab state={state} errors={errors} onChange={patch} />}

      {/* Barra inferior fija con la acción principal, útil en mobile y en formularios largos. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-negro/10 bg-blanco/95 px-4 py-3 backdrop-blur lg:pl-[calc(15rem+1rem)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="truncate text-xs text-gris-medio">
            {esEdicion
              ? 'Los cambios no se guardan hasta que apretás “Guardar cambios”.'
              : 'El producto se crea con sus variantes e imágenes en un solo paso.'}
          </p>
          <div className="flex gap-2">
            <Btn
              variant="secondary"
              onClick={() => router.push('/admin/productos')}
              disabled={guardando}
            >
              Cancelar
            </Btn>
            <Btn onClick={() => void guardar()} loading={guardando}>
              {esEdicion ? 'Guardar cambios' : 'Crear producto'}
            </Btn>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmarEliminar}
        onClose={() => !eliminando && setConfirmarEliminar(false)}
        onConfirm={() => void eliminar()}
        title="Eliminar producto"
        description={`Se eliminará “${producto?.nombre ?? ''}” con todas sus variantes e imágenes. Si querés sacarlo de la tienda sin borrarlo, archivalo.`}
        confirmLabel="Eliminar definitivamente"
        danger
        loading={eliminando}
      />
    </div>
  );
}

const ars = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

/** Margen de la óptica: precio web sin IVA contra el precio mayorista. */
function MargenOptica({ precio, precioMayorista }: { precio: string; precioMayorista: string }) {
  const m = calcularMargen(precio, precioMayorista);
  if (!m) {
    return (
      <p className="rounded-lg bg-gris-claro px-3 py-2 text-xs text-gris-medio" data-testid="margen-optica">
        Cargá los dos precios para ver el margen de la óptica.
      </p>
    );
  }
  const negativo = m.ganancia < 0;
  const filas: Array<[string, string]> = [
    ['Precio web sin IVA', ars(m.webSinIva)],
    ['Ganancia de la óptica', ars(m.ganancia)],
    ['Margen de la óptica', `${m.margenPct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`],
  ];
  return (
    <div
      className={cn('rounded-lg px-3 py-2 text-xs', negativo ? 'bg-carey/10 text-carey' : 'bg-gris-claro')}
      data-testid="margen-optica"
    >
      <dl className="space-y-1">
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className={negativo ? '' : 'text-gris-medio'}>{k}</dt>
            <dd className="font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {negativo && <p className="mt-1.5">El mayorista supera al precio web sin IVA: la óptica pierde plata.</p>}
    </div>
  );
}
