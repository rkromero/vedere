'use client';
// Monta a sus hijos recién cuando el bloque se acerca al viewport: evita que las imágenes de las
// secciones de abajo compitan con la imagen principal (LCP) en celular.
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export function LazyMount({
  children,
  rootMargin = '400px',
  className,
  minHeight,
}: {
  children: ReactNode;
  rootMargin?: string;
  className?: string;
  /** Altura reservada mientras no se monta (evita saltos de layout). */
  minHeight?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} className={className} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
}
