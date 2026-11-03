'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { LABELS, formatFecha, formatPrecio, options } from '@/lib/format';
import type { Categoria, Coleccion, Marca, Paged, Producto } from '@/lib/types';
import {
  FilterSelect,
  Pagination,
  SearchInput,
  Table,
  Td,
  Th,
  Toolbar,
  Tr,
} from '@/components/admin/table';
import {
  Badge,
  Btn,
  ConfirmDialog,
  EmptyState,
  LinkBtn,
  Modal,
  PageHeader,
  estadoTone,
} from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';

type Accion = 'publicar' | 'archivar' | 'borrador' | 'destacar' | 'eliminar';

interface ImportResult {
  productosCreados: number;
  productosActualizados: number;
  variantesCreadas: number;
  variantesActualizadas: number;
  filas: number;
}

interface ImportError {
  fila: number;
  mensaje: string;
}

const ACCION_LABEL: Record<Accion, string> = {
  publicar: 'Publicar',
  archivar: 'Archivar',
  borrador: 'Pasar a borrador',
  destacar: 'Destacar',
  eliminar: 'Eliminar',
};

const SORT_OPTIONS = [
  { value: 'actualizado', label: 'Última actualización' },
  { value: 'reciente', label: 'Más recientes' },
  { value: 'nombre', label: 'Nombre' },
  { value: 'precio_asc', label: 'Precio: menor a mayor' },
  { value: 'precio_desc', label: 'Precio: mayor a menor' },
  { value: 'vendidos', label: 'Más vendidos' },
];

export function ProductosTable({
  data,
  marcas,
  categorias,
  colecciones,
}: {
  data: Paged<Producto>;
  marcas: Marca[];
  categorias: Categoria[];
  colecciones: Coleccion[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [pendiente, setPendiente] = useState<Accion | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importResultado, setImportResultado] = useState<ImportResult | null>(null);
  const [importErrores, setImportErrores] = useState<ImportError[] | null>(null);
  const [importMensaje, setImportMensaje] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ids = data.items.map((p) => p.id);
  const todosSeleccionados = ids.length > 0 && ids.every((id) => seleccion.has(id));

  const categoriaOptions = useMemo(() => {
    const raices = categorias.filter((c) => !c.padreId).sort((a, b) => a.orden - b.orden);
    const out: Array<{ value: string; label: string }> = [];
    for (const r of raices) {
      out.push({ value: r.id, label: r.nombre });
      categorias
        .filter((c) => c.padreId === r.id)
        .sort((a, b) => a.orden - b.orden)
        .forEach((h) => out.push({ value: h.id, label: `— ${h.nombre}` }));
    }
    return out;
  }, [categorias]);

  function toggle(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    setSeleccion(todosSeleccionados ? new Set() : new Set(ids));
  }

  async function ejecutar(accion: Accion) {
    if (seleccion.size === 0) return;
    setPendiente(accion);
    try {
      const r = await api.post<{ afectados: number }>('/admin/productos/bulk', {
        ids: Array.from(seleccion),
        accion,
      });
      toast.ok(`${ACCION_LABEL[accion]}: ${r.afectados} producto${r.afectados === 1 ? '' : 's'}`);
      setSeleccion(new Set());
      setConfirmarEliminar(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPendiente(null);
    }
  }

  async function importar(file: File) {
    setImportando(true);
    setImportErrores(null);
    setImportResultado(null);
    setImportMensaje(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post<ImportResult>('/admin/productos/import', fd);
      setImportResultado(r);
      toast.ok('Importación completada');
      router.refresh();
    } catch (err) {
      const detalles =
        err instanceof ApiError && err.details && typeof err.details === 'object'
          ? (err.details as { errores?: ImportError[] }).errores
          : undefined;
      setImportMensaje(errorMessage(err));
      setImportErrores(detalles ?? []);
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const importAbierto = importResultado !== null || importErrores !== null;

  return (
    <>
      <PageHeader
        title="Productos"
        description={`${data.total} producto${data.total === 1 ? '' : 's'} en el catálogo`}
        actions={
          <>
            <a
              href="/api/admin/productos/export.csv"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-negro/20 bg-blanco px-4 text-sm font-medium text-negro transition-colors hover:bg-gris-claro"
            >
              Exportar CSV
            </a>
            <Btn variant="secondary" onClick={() => fileRef.current?.click()} loading={importando}>
              Importar CSV
            </Btn>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importar(f);
              }}
            />
            <LinkBtn href="/admin/productos/nuevo">Nuevo producto</LinkBtn>
          </>
        }
      />

      <Toolbar>
        <SearchInput placeholder="Buscar por nombre, slug o SKU…" />
        <FilterSelect param="estado" label="Estado" options={options(LABELS.estado)} />
        <FilterSelect param="linea" label="Línea" options={options(LABELS.linea)} />
        <FilterSelect
          param="marcaId"
          label="Marca"
          options={marcas.map((m) => ({ value: m.id, label: m.nombre }))}
          allLabel="Todas"
        />
        <FilterSelect
          param="categoriaId"
          label="Categoría"
          options={categoriaOptions}
          allLabel="Todas"
        />
        <FilterSelect
          param="coleccionId"
          label="Colección"
          options={colecciones.map((c) => ({ value: c.id, label: c.nombre }))}
          allLabel="Todas"
        />
        <FilterSelect
          param="bajoStock"
          label="Stock"
          options={[{ value: 'true', label: 'Stock bajo' }]}
          allLabel="Todo"
        />
        <FilterSelect
          param="sort"
          label="Orden"
          options={SORT_OPTIONS}
          allLabel="Última actualización"
        />
      </Toolbar>

      {seleccion.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-negro px-4 py-2.5 text-sm text-blanco">
          <span className="mr-2 font-medium">
            {seleccion.size} seleccionado{seleccion.size === 1 ? '' : 's'}
          </span>
          {(['publicar', 'archivar', 'borrador', 'destacar'] as Accion[]).map((a) => (
            <button
              key={a}
              type="button"
              disabled={pendiente !== null}
              onClick={() => ejecutar(a)}
              className="rounded-md border border-blanco/30 px-3 py-1 text-xs font-medium hover:bg-blanco/10 disabled:opacity-50"
            >
              {pendiente === a ? '…' : ACCION_LABEL[a]}
            </button>
          ))}
          <button
            type="button"
            disabled={pendiente !== null}
            onClick={() => setConfirmarEliminar(true)}
            className="rounded-md border border-carey/60 px-3 py-1 text-xs font-medium text-sol hover:bg-blanco/10 disabled:opacity-50"
          >
            Eliminar
          </button>
          <button
            type="button"
            onClick={() => setSeleccion(new Set())}
            className="ml-auto text-xs underline-offset-2 hover:underline"
          >
            Limpiar selección
          </button>
        </div>
      )}

      {data.items.length === 0 ? (
        <EmptyState
          title="No hay productos para mostrar"
          description="Probá con otros filtros o creá el primer producto del catálogo."
          action={<LinkBtn href="/admin/productos/nuevo">Nuevo producto</LinkBtn>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-10">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos"
                  className="h-4 w-4 accent-negro"
                  checked={todosSeleccionados}
                  onChange={toggleTodos}
                />
              </Th>
              <Th className="w-14" />
              <Th>Producto</Th>
              <Th>Marca</Th>
              <Th>Línea</Th>
              <Th align="right">Precio</Th>
              <Th align="right">Stock</Th>
              <Th>Estado</Th>
              <Th>Actualizado</Th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((p) => {
              const algunaBaja = p.variantes.some((v) => v.bajoStock);
              return (
                <Tr key={p.id} selected={seleccion.has(p.id)}>
                  <Td>
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${p.nombre}`}
                      className="h-4 w-4 accent-negro"
                      checked={seleccion.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                  </Td>
                  <Td>
                    {p.imagenPrincipal ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imagenPrincipal}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-gris-claro" aria-hidden="true" />
                    )}
                  </Td>
                  <Td>
                    <Link href={`/admin/productos/${p.id}`} className="font-medium hover:underline">
                      {p.nombre}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-gris-medio">
                      <span>{p.slug}</span>
                      {p.destacado && <Badge tone="info">Destacado</Badge>}
                    </div>
                  </Td>
                  <Td>{p.marca?.nombre ?? <span className="text-gris-medio">—</span>}</Td>
                  <Td>{LABELS.linea[p.linea]}</Td>
                  <Td align="right">
                    <span className="font-medium">{formatPrecio(p.precio)}</span>
                    {p.precioLista && p.precioLista > p.precio && (
                      <div className="text-xs text-gris-medio line-through">
                        {formatPrecio(p.precioLista)}
                      </div>
                    )}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-2">
                      <span>{p.stockTotal}</span>
                      {algunaBaja && <Badge tone="warn">Bajo</Badge>}
                    </div>
                    <div className="text-xs text-gris-medio">
                      {p.variantes.length} variante{p.variantes.length === 1 ? '' : 's'}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={estadoTone(p.estado)}>{LABELS.estado[p.estado]}</Badge>
                  </Td>
                  <Td className="text-gris-medio">{formatFecha(p.updatedAt, true)}</Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {data.total > 0 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
        />
      )}

      <ConfirmDialog
        open={confirmarEliminar}
        onClose={() => setConfirmarEliminar(false)}
        onConfirm={() => ejecutar('eliminar')}
        title={`Eliminar ${seleccion.size} producto${seleccion.size === 1 ? '' : 's'}`}
        description="Se borran también sus variantes e imágenes. Esta acción no se puede deshacer. Si querés sacarlos de la tienda sin perderlos, usá Archivar."
        confirmLabel="Eliminar"
        danger
        loading={pendiente === 'eliminar'}
      />

      <Modal
        open={importAbierto}
        onClose={() => {
          setImportResultado(null);
          setImportErrores(null);
          setImportMensaje(null);
        }}
        title={importResultado ? 'Importación completada' : 'La importación falló'}
        footer={
          <Btn
            onClick={() => {
              setImportResultado(null);
              setImportErrores(null);
              setImportMensaje(null);
            }}
          >
            Cerrar
          </Btn>
        }
      >
        {importResultado && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-gris-claro px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-gris-medio">Productos creados</dt>
              <dd className="text-xl font-semibold">{importResultado.productosCreados}</dd>
            </div>
            <div className="rounded-lg bg-gris-claro px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-gris-medio">
                Productos actualizados
              </dt>
              <dd className="text-xl font-semibold">{importResultado.productosActualizados}</dd>
            </div>
            <div className="rounded-lg bg-gris-claro px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-gris-medio">Variantes creadas</dt>
              <dd className="text-xl font-semibold">{importResultado.variantesCreadas}</dd>
            </div>
            <div className="rounded-lg bg-gris-claro px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-gris-medio">
                Variantes actualizadas
              </dt>
              <dd className="text-xl font-semibold">{importResultado.variantesActualizadas}</dd>
            </div>
            <p className="col-span-2 text-xs text-gris-medio">
              {importResultado.filas} filas procesadas.
            </p>
          </dl>
        )}
        {importErrores && (
          <div className="space-y-3 text-sm">
            <p className="rounded-lg bg-carey/10 px-3 py-2 text-carey">{importMensaje}</p>
            {importErrores.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-negro/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <Th className="w-20">Fila</Th>
                      <Th>Error</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {importErrores.map((e, i) => (
                      <tr key={i}>
                        <Td>{e.fila}</Td>
                        <Td>{e.mensaje}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-gris-medio">
              No se importó ninguna fila. Corregí el archivo y volvé a intentar.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
