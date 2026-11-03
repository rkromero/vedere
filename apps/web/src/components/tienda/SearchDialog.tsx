'use client';
// Buscador con sugerencias en vivo (patrón combobox: flechas, Enter, Esc).
import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Drawer, IconArrowRight, IconSearch, Spinner, formatARS } from '@vedere/ui';
import { tiendaApi } from '@/lib/tienda/client';
import type { Sugerencias } from '@/lib/tienda/types';

const SUGERIDAS = ['Aviador', 'Redondos', 'Polarizados', 'Multifocal', 'Carey'];

type Opcion =
  | { tipo: 'producto'; href: string; label: string; sub: string; imagen: string | null }
  | { tipo: 'coleccion'; href: string; label: string; sub: string; hex: string }
  | { tipo: 'categoria'; href: string; label: string; sub: string }
  | { tipo: 'buscar'; href: string; label: string; sub: string };

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [datos, setDatos] = useState<Sugerencias | null>(null);
  const [cargando, setCargando] = useState(false);
  const [activo, setActivo] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setDatos(null);
      setActivo(-1);
      return;
    }
    let cancelado = false;
    setCargando(true);
    const t = setTimeout(async () => {
      try {
        const res = await tiendaApi.get<Sugerencias>(
          `/catalogo/sugerencias?q=${encodeURIComponent(term)}`,
        );
        if (!cancelado) setDatos(res);
      } catch {
        if (!cancelado) setDatos(null);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }, 200);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [q]);

  const term = q.trim();
  const opciones: Opcion[] = [];
  if (datos) {
    for (const c of datos.colecciones)
      opciones.push({ tipo: 'coleccion', href: `/coleccion/${c.slug}`, label: c.nombre, sub: 'Colección', hex: c.colorHex });
    for (const c of datos.categorias)
      opciones.push({ tipo: 'categoria', href: `/categoria/${c.slug}`, label: c.nombre, sub: 'Categoría' });
    for (const p of datos.productos)
      opciones.push({
        tipo: 'producto',
        href: `/p/${p.slug}`,
        label: p.nombre,
        sub: `${p.marca ? p.marca + ' · ' : ''}${formatARS(p.precio)}`,
        imagen: p.imagen,
      });
  }
  if (term.length >= 2) {
    opciones.push({
      tipo: 'buscar',
      href: `/buscar?q=${encodeURIComponent(term)}`,
      label: `Ver todos los resultados para “${term}”`,
      sub: '',
    });
  }

  function ir(href: string) {
    onClose();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((a) => Math.min(a + 1, opciones.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const op = activo >= 0 ? opciones[activo] : null;
      if (op) ir(op.href);
      else if (term.length >= 1) ir(`/buscar?q=${encodeURIComponent(term)}`);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Buscar" side="bottom" hideTitle className="sm:max-w-xl">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (term) ir(`/buscar?q=${encodeURIComponent(term)}`);
        }}
        className="relative"
      >
        <label htmlFor={`${listId}-input`} className="sr-only">
          Buscar productos
        </label>
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gris-texto" />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="¿Qué estás buscando?"
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={opciones.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activo >= 0 ? `${listId}-${activo}` : undefined}
          className="font-text h-14 w-full rounded-2xl border border-negro/15 bg-gris-claro pl-12 pr-12 text-lg text-negro placeholder:text-gris-texto focus:border-negro focus:outline-none"
        />
        {cargando && <Spinner className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2" />}
      </form>

      {term.length < 2 ? (
        <div className="font-text mt-5">
          <p className="mb-2 text-sm text-gris-texto">Búsquedas populares</p>
          <div className="flex flex-wrap gap-2">
            {SUGERIDAS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQ(s)}
                className="h-10 rounded-full border border-negro/15 px-4 text-sm hover:border-negro"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul id={listId} role="listbox" aria-label="Sugerencias" className="font-text mt-4 divide-y divide-negro/5">
          {opciones.length === 1 && !cargando && (
            <li className="py-3 text-sm text-gris-texto">No encontramos nada con ese nombre todavía.</li>
          )}
          {opciones.map((op, i) => (
            <li
              key={op.href}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={activo === i}
              onMouseEnter={() => setActivo(i)}
            >
              <Link
                href={op.href}
                onClick={(e) => {
                  e.preventDefault();
                  ir(op.href);
                }}
                tabIndex={-1}
                className={`flex items-center gap-3 rounded-xl px-2 py-2.5 ${activo === i ? 'bg-gris-claro' : ''}`}
              >
                {op.tipo === 'producto' ? (
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gris-claro">
                    {op.imagen && (
                      <Image src={op.imagen} alt="" fill sizes="48px" className="object-cover" />
                    )}
                  </span>
                ) : op.tipo === 'coleccion' ? (
                  <span
                    className="h-12 w-12 shrink-0 rounded-lg"
                    style={{ backgroundColor: op.hex }}
                    aria-hidden="true"
                  />
                ) : (
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gris-claro text-negro">
                    {op.tipo === 'buscar' ? <IconArrowRight /> : <IconSearch />}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">{op.label}</span>
                  {op.sub && <span className="block text-sm text-gris-texto">{op.sub}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
