'use client';
// Galería de producto estilo editorial: en desktop todas las fotos de la variante en una grilla de dos
// columnas que scrollea con la página (el panel de compra queda fijo al lado); en celular carrusel con
// scroll-snap y puntos. Cualquier foto abre el lightbox a pantalla completa con zoom por toque.
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { IconChevronLeft, IconChevronRight, IconClose, IconZoom, cn } from '@vedere/ui';
import type { Imagen } from '@/lib/types';

interface Props {
  imagenes: Imagen[];
  nombre: string;
  color: string;
  etiquetas?: React.ReactNode;
}

function alt(img: Imagen, nombre: string, color: string, i: number) {
  return img.alt ?? `${nombre} color ${color}, foto ${i + 1}`;
}

export function Galeria({ imagenes, nombre, color, etiquetas }: Props) {
  const [actual, setActual] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const scroller = useRef<HTMLUListElement>(null);

  // Al cambiar de color (nuevas imágenes), volver a la primera.
  useEffect(() => {
    setActual(0);
    scroller.current?.scrollTo({ left: 0 });
  }, [imagenes]);

  const irA = useCallback((i: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * i, behavior: 'smooth' });
    setActual(i);
  }, []);

  function onScroll() {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== actual) setActual(i);
  }

  if (imagenes.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center bg-gris-claro text-gris-texto">
        Sin fotos todavía
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Celular: carrusel con swipe */}
      <ul
        ref={scroller}
        onScroll={onScroll}
        className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto bg-gris-claro lg:hidden"
        aria-label={`Fotos de ${nombre}`}
        aria-roledescription="carrusel"
      >
        {imagenes.map((img, i) => (
          <li key={img.id ?? i} className="relative aspect-square w-full shrink-0 snap-center">
            <button
              type="button"
              onClick={() => setLightbox(i)}
              className="relative block h-full w-full"
              aria-label={`Ampliar foto ${i + 1}`}
            >
              <Image
                src={img.url}
                alt={alt(img, nombre, color, i)}
                fill
                priority={i === 0}
                fetchPriority={i === 0 ? 'high' : undefined}
                sizes="100vw"
                className="object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {/* Desktop: grilla de dos columnas con todas las fotos */}
      <ul
        className="hidden grid-cols-2 gap-1 lg:grid"
        aria-label={`Fotos de ${nombre}`}
      >
        {imagenes.map((img, i) => (
          <li
            key={img.id ?? i}
            className={cn(
              'group relative aspect-square overflow-hidden bg-gris-claro',
              // Con cantidad impar, la última foto ocupa el ancho completo (como una toma de campaña).
              imagenes.length % 2 === 1 && i === imagenes.length - 1 && 'col-span-2 aspect-[2/1]',
            )}
          >
            <button
              type="button"
              onClick={() => setLightbox(i)}
              className="relative block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-noche"
              aria-label={`Ampliar foto ${i + 1}`}
            >
              <Image
                src={img.url}
                alt={alt(img, nombre, color, i)}
                fill
                priority={i < 2}
                fetchPriority={i === 0 ? 'high' : undefined}
                sizes="(min-width: 1024px) 33vw, 100vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </button>
            <span className="pointer-events-none absolute bottom-3 right-3 inline-flex h-9 items-center gap-1.5 bg-blanco/90 px-3 text-[11px] font-semibold uppercase tracking-wider text-negro opacity-0 transition-opacity group-hover:opacity-100">
              <IconZoom size={16} /> Ampliar
            </span>
          </li>
        ))}
      </ul>

      {etiquetas && <div className="absolute left-3 top-3 flex gap-1.5">{etiquetas}</div>}

      {/* Puntos (celular) */}
      {imagenes.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5 lg:hidden" role="tablist" aria-label="Fotos">
          {imagenes.map((img, i) => (
            <button
              key={img.id ?? i}
              type="button"
              role="tab"
              aria-selected={i === actual}
              aria-label={`Foto ${i + 1}`}
              onClick={() => irA(i)}
              className="flex h-8 w-6 items-center justify-center"
            >
              <span
                className={cn(
                  'block h-1.5 transition-all',
                  i === actual ? 'w-6 bg-negro' : 'w-2 bg-negro/25',
                )}
              />
            </button>
          ))}
        </div>
      )}

      {lightbox !== null && (
        <Lightbox
          imagenes={imagenes}
          inicial={lightbox}
          nombre={nombre}
          color={color}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function Lightbox({
  imagenes,
  inicial,
  nombre,
  color,
  onClose,
}: {
  imagenes: Imagen[];
  inicial: number;
  nombre: string;
  color: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(inicial);
  const [ampliado, setAmpliado] = useState<{ x: number; y: number } | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.showModal();
    document.body.style.overflow = 'hidden';
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener('cancel', onCancel);
    return () => {
      el.removeEventListener('cancel', onCancel);
      document.body.style.overflow = '';
      if (el.open) el.close();
    };
  }, [onClose]);

  const prev = () => {
    setAmpliado(null);
    setI((x) => (x - 1 + imagenes.length) % imagenes.length);
  };
  const next = () => {
    setAmpliado(null);
    setI((x) => (x + 1) % imagenes.length);
  };

  const img = imagenes[i];
  if (!img) return null;
  return (
    <dialog
      ref={ref}
      aria-label={`Fotos de ${nombre}`}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-negro p-0 text-blanco backdrop:bg-negro"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') prev();
        if (e.key === 'ArrowRight') next();
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="font-text text-sm text-blanco/80">
            {i + 1} / {imagenes.length} · {ampliado ? 'Tocá para reducir' : 'Tocá para ampliar'}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-blanco/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blanco"
          >
            <IconClose />
          </button>
        </div>
        <div
          className="relative min-h-0 flex-1 overflow-hidden"
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) touch.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const t = e.changedTouches[0];
            if (!touch.current || ampliado || !t) return;
            const dx = t.clientX - touch.current.x;
            if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
            touch.current = null;
          }}
        >
          <button
            type="button"
            aria-label={ampliado ? 'Reducir' : 'Ampliar'}
            onClick={(e) => {
              if (ampliado) return setAmpliado(null);
              const r = e.currentTarget.getBoundingClientRect();
              setAmpliado({
                x: ((e.clientX - r.left) / r.width) * 100,
                y: ((e.clientY - r.top) / r.height) * 100,
              });
            }}
            className={cn('relative block h-full w-full', ampliado ? 'cursor-zoom-out' : 'cursor-zoom-in')}
          >
            <Image
              key={img.id ?? i}
              src={img.url}
              alt={alt(img, nombre, color, i)}
              fill
              sizes="100vw"
              className="object-contain transition-transform duration-200"
              style={
                ampliado
                  ? { transform: 'scale(2.5)', transformOrigin: `${ampliado.x}% ${ampliado.y}%` }
                  : undefined
              }
            />
          </button>
          {imagenes.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Foto anterior"
                className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-blanco/15 hover:bg-blanco/30 sm:inline-flex"
              >
                <IconChevronLeft />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Foto siguiente"
                className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-blanco/15 hover:bg-blanco/30 sm:inline-flex"
              >
                <IconChevronRight />
              </button>
            </>
          )}
        </div>
        <div className="flex justify-center gap-2 px-3 py-3" role="tablist" aria-label="Fotos">
          {imagenes.map((im, k) => (
            <button
              key={im.id ?? k}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={`Foto ${k + 1}`}
              onClick={() => {
                setAmpliado(null);
                setI(k);
              }}
              className={cn(
                'relative h-14 w-14 overflow-hidden bg-blanco/10',
                k === i && 'ring-2 ring-blanco',
              )}
            >
              <Image src={im.urlMiniatura ?? im.url} alt="" fill sizes="56px" className="object-cover" />
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
