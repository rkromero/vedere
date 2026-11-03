'use client';
// Galería de producto: swipe con scroll-snap en celular, miniaturas en desktop, zoom por hover y
// lightbox a pantalla completa con zoom por toque.
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
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
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
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-gris-claro text-gris-texto">
        Sin fotos todavía
      </div>
    );
  }

  const principal = imagenes[actual] ?? imagenes[0];
  if (!principal) return null;

  return (
    <div className="lg:grid lg:grid-cols-[4.5rem_1fr] lg:gap-3">
      {/* Miniaturas (desktop) */}
      <ul className="order-first hidden lg:flex lg:flex-col lg:gap-2" aria-label="Miniaturas">
        {imagenes.map((img, i) => (
          <li key={img.id ?? i}>
            <button
              type="button"
              onClick={() => irA(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === actual ? 'true' : undefined}
              className={cn(
                'relative block aspect-square w-full overflow-hidden rounded-lg bg-gris-claro ring-offset-2 transition-shadow',
                i === actual ? 'ring-2 ring-negro' : 'hover:ring-2 hover:ring-negro/30',
              )}
            >
              <Image
                src={img.urlMiniatura ?? img.urlMediana ?? img.url}
                alt=""
                fill
                sizes="72px"
                className="object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      <div className="relative">
        {/* Carrusel con swipe (celular) / imagen principal con zoom (desktop) */}
        <ul
          ref={scroller}
          onScroll={onScroll}
          className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto rounded-2xl bg-gris-claro lg:hidden"
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

        <div
          className="group relative hidden aspect-square overflow-hidden rounded-2xl bg-gris-claro lg:block"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onMouseLeave={() => setZoom(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(actual)}
            className="relative block h-full w-full cursor-zoom-in"
            aria-label="Ampliar foto"
          >
            <Image
              key={principal.id ?? actual}
              src={principal.url}
              alt={alt(principal, nombre, color, actual)}
              fill
              priority
              fetchPriority="high"
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover transition-transform duration-150"
              style={
                zoom
                  ? { transform: 'scale(2)', transformOrigin: `${zoom.x}% ${zoom.y}%` }
                  : undefined
              }
            />
          </button>
          <span className="pointer-events-none absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-blanco/90 text-negro opacity-0 transition-opacity group-hover:opacity-100">
            <IconZoom size={18} />
          </span>
          {imagenes.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => irA((actual - 1 + imagenes.length) % imagenes.length)}
                aria-label="Foto anterior"
                className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-blanco/90 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <IconChevronLeft />
              </button>
              <button
                type="button"
                onClick={() => irA((actual + 1) % imagenes.length)}
                aria-label="Foto siguiente"
                className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-blanco/90 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <IconChevronRight />
              </button>
            </>
          )}
        </div>

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
                    'block h-2 rounded-full transition-all',
                    i === actual ? 'w-5 bg-negro' : 'w-2 bg-negro/25',
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </div>

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
                'relative h-14 w-14 overflow-hidden rounded-lg bg-blanco/10',
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
