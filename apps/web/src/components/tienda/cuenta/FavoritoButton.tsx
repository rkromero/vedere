'use client';
// Corazón de favoritos (prompt 6): con sesión alterna PUT/DELETE /cuenta/favoritos/:productoId (optimista);
// sin sesión lleva a /ingresar con `next` a la página actual. El estado vive en FavoritosProvider (store).
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@vedere/ui';
import { useFavoritos } from './FavoritosProvider';

export function FavoritoButton({
  productoId,
  className,
  size = 'md',
}: {
  productoId: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const { estado, esFavorito, cargar, alternar } = useFavoritos();
  const router = useRouter();
  const pathname = usePathname();
  const [ocupado, setOcupado] = useState(false);
  const activo = esFavorito(productoId);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (estado === 'anonimo') {
      router.push(`/ingresar?next=${encodeURIComponent(pathname || '/')}`);
      return;
    }
    if (ocupado) return;
    setOcupado(true);
    try {
      await alternar(productoId);
    } catch {
      // Sin sesión válida (401) → mandar a ingresar.
      router.push(`/ingresar?next=${encodeURIComponent(pathname || '/')}`);
    } finally {
      setOcupado(false);
    }
  }

  const dim = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={activo ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      title={activo ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      data-testid="favorito-toggle"
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-blanco/90 text-negro shadow-sm backdrop-blur transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche',
        dim,
        className,
      )}
    >
      <svg
        width={size === 'sm' ? 18 : 22}
        height={size === 'sm' ? 18 : 22}
        viewBox="0 0 24 24"
        fill={activo ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn(activo && 'text-carey')}
      >
        <path d="M12 21s-7.5-4.6-9.5-9.2C1 8 3.3 4.5 6.9 4.5c2 0 3.5 1.1 5.1 3 1.6-1.9 3.1-3 5.1-3 3.6 0 5.9 3.5 4.4 7.3C19.5 16.4 12 21 12 21z" />
      </svg>
    </button>
  );
}
