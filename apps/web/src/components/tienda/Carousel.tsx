'use client';
// Carrusel horizontal con scroll-snap (swipe en celular) y flechas en desktop.
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { IconChevronLeft, IconChevronRight, cn } from '@vedere/ui';

export function Carousel({
  children,
  label,
  className,
  itemClassName = 'w-[70vw] sm:w-[44vw] lg:w-[23%]',
}: {
  children: ReactNode[];
  label: string;
  className?: string;
  itemClassName?: string;
}) {
  const ref = useRef<HTMLUListElement>(null);

  function scroll(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  return (
    <div className={cn('relative', className)}>
      <ul
        ref={ref}
        aria-label={label}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
      >
        {children.map((child, i) => (
          <li key={i} className={cn('shrink-0 snap-start', itemClassName)}>
            {child}
          </li>
        ))}
      </ul>
      <div className="pointer-events-none absolute -top-14 right-0 hidden gap-2 lg:flex">
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Anterior"
          className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-negro/15 bg-blanco hover:bg-gris-claro"
        >
          <IconChevronLeft />
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="Siguiente"
          className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-negro/15 bg-blanco hover:bg-gris-claro"
        >
          <IconChevronRight />
        </button>
      </div>
    </div>
  );
}
