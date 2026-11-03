'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@vedere/ui';
import { api, errorMessage } from '@/lib/api-client';
import { LABELS, options } from '@/lib/format';
import type { TipoImagen } from '@/lib/format';
import type { Imagen } from '@/lib/types';
import { Btn, Field, Input, Select, Spinner } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';
import type { VarianteForm } from './form-types';

const TIPOS = options(LABELS.tipoImagen);

const TIPOS_POR_POSICION: TipoImagen[] = ['FRENTE', 'PERFIL', 'TRES_CUARTOS', 'PUESTO'];

export function ImagenesTab({
  variantes,
  onChange,
}: {
  variantes: VarianteForm[];
  onChange: (variantes: VarianteForm[]) => void;
}) {
  const toast = useToast();
  const [activa, setActiva] = useState<string>(variantes[0]?.key ?? '');
  const [driver, setDriver] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<{ actual: number; total: number } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<{ driver: string }>('/admin/imagenes/config')
      .then((c) => setDriver(c.driver))
      .catch(() => setDriver(null));
  }, []);

  useEffect(() => {
    if (!variantes.some((v) => v.key === activa)) setActiva(variantes[0]?.key ?? '');
  }, [variantes, activa]);

  const idx = variantes.findIndex((v) => v.key === activa);
  const variante = idx >= 0 ? variantes[idx] : undefined;

  function setImagenes(imagenes: Imagen[]) {
    if (idx < 0) return;
    onChange(variantes.map((v, j) => (j === idx ? { ...v, imagenes } : v)));
  }

  function updateImagen(i: number, patch: Partial<Imagen>) {
    if (!variante) return;
    setImagenes(variante.imagenes.map((img, j) => (j === i ? { ...img, ...patch } : img)));
  }

  function mover(from: number, to: number) {
    if (!variante || from === to || to < 0 || to >= variante.imagenes.length) return;
    const next = [...variante.imagenes];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    setImagenes(next.map((img, j) => ({ ...img, orden: j })));
  }

  async function subir(files: FileList) {
    if (!variante) return;
    const lista = Array.from(files);
    setSubiendo({ actual: 0, total: lista.length });
    const nuevas: Imagen[] = [];
    try {
      for (const [i, file] of lista.entries()) {
        setSubiendo({ actual: i + 1, total: lista.length });
        const r = await api.upload(file, 'productos');
        const orden = variante.imagenes.length + nuevas.length;
        nuevas.push({
          // Las primeras cuatro posiciones se asignan a frente / perfil / 3/4 / puesto; después, "otra".
          tipo: TIPOS_POR_POSICION[orden] ?? 'OTRA',
          orden,
          url: r.url,
          urlMediana: r.urlMediana,
          urlMiniatura: r.urlMiniatura,
          alt: null,
        });
      }
      setImagenes([...variante.imagenes, ...nuevas]);
      toast.ok(
        `${nuevas.length} imagen${nuevas.length === 1 ? '' : 'es'} subida${nuevas.length === 1 ? '' : 's'}`,
      );
    } catch (err) {
      if (nuevas.length) setImagenes([...variante.imagenes, ...nuevas]);
      toast.error(errorMessage(err));
    } finally {
      setSubiendo(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (variantes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-negro/20 px-4 py-6 text-center text-sm text-gris-medio">
        Primero agregá una variante en la pestaña “Variantes y stock”; las imágenes se cargan por
        variante (color).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {driver === 'local' && (
        <p className="rounded-lg bg-sol/20 px-3 py-2 text-xs text-negro/80">
          El almacenamiento está en modo <strong>local</strong> (disco del servidor). Configurá
          Cloudflare R2 en producción para que las imágenes persistan entre deploys.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Variante" className="w-full sm:w-72">
          <Select value={activa} onChange={(e) => setActiva(e.target.value)}>
            {variantes.map((v, i) => (
              <option key={v.key} value={v.key}>
                {`${i + 1}. ${v.colorArmazon || 'Sin color'}${v.sku ? ` · ${v.sku}` : ''} (${v.imagenes.length})`}
              </option>
            ))}
          </Select>
        </Field>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="hidden"
          onChange={(e) =>
            e.target.files && e.target.files.length > 0 && void subir(e.target.files)
          }
        />
        <Btn
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={!variante || subiendo !== null}
        >
          {subiendo ? (
            <>
              <Spinner className="h-3.5 w-3.5" /> Subiendo {subiendo.actual}/{subiendo.total}
            </>
          ) : (
            'Subir imágenes'
          )}
        </Btn>
        <p className="text-xs text-gris-medio">
          JPG, PNG, WebP o AVIF. Se convierten a WebP en 3 tamaños.
        </p>
      </div>

      {variante && variante.imagenes.length === 0 && (
        <p className="rounded-lg border border-dashed border-negro/20 px-4 py-8 text-center text-sm text-gris-medio">
          Esta variante no tiene imágenes. Subí frente, perfil, 3/4 y puesto para una buena ficha.
        </p>
      )}

      {variante && variante.imagenes.length > 0 && (
        <ul
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Imágenes de la variante (arrastrá para ordenar)"
        >
          {variante.imagenes.map((img, i) => (
            <li
              key={`${img.url}-${i}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(i);
              }}
              onDragLeave={() => setOverIndex(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) mover(dragIndex, i);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={cn(
                'rounded-xl border bg-blanco p-3 transition-colors',
                overIndex === i && dragIndex !== i ? 'border-negro' : 'border-negro/10',
                dragIndex === i && 'opacity-50',
              )}
            >
              <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-gris-claro">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.urlMediana ?? img.url}
                  alt={img.alt ?? ''}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
                <span className="absolute left-2 top-2 rounded-full bg-negro px-2 py-0.5 text-xs font-medium text-blanco">
                  {i + 1}
                </span>
                <span
                  className="absolute right-2 top-2 cursor-grab rounded-md bg-blanco/90 px-1.5 py-0.5 text-xs text-gris-medio"
                  title="Arrastrar para ordenar"
                >
                  ⋮⋮
                </span>
              </div>
              <div className="space-y-2">
                <Select
                  aria-label="Tipo de imagen"
                  value={img.tipo}
                  onChange={(e) => updateImagen(i, { tipo: e.target.value as TipoImagen })}
                  className="h-9 text-xs"
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label="Texto alternativo"
                  placeholder="Texto alternativo (alt)"
                  value={img.alt ?? ''}
                  maxLength={160}
                  onChange={(e) => updateImagen(i, { alt: e.target.value })}
                  className="h-9 text-xs"
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <Btn
                      variant="ghost"
                      size="sm"
                      aria-label="Mover antes"
                      disabled={i === 0}
                      onClick={() => mover(i, i - 1)}
                    >
                      ↑
                    </Btn>
                    <Btn
                      variant="ghost"
                      size="sm"
                      aria-label="Mover después"
                      disabled={i === variante.imagenes.length - 1}
                      onClick={() => mover(i, i + 1)}
                    >
                      ↓
                    </Btn>
                  </div>
                  <Btn
                    variant="danger"
                    size="sm"
                    onClick={() =>
                      setImagenes(
                        variante.imagenes
                          .filter((_, j) => j !== i)
                          .map((x, j) => ({ ...x, orden: j })),
                      )
                    }
                  >
                    Quitar
                  </Btn>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
