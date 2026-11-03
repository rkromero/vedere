'use client';
// Favoritos de la cuenta: grilla con ProductCard (el corazón de cada tarjeta permite quitarlos).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buttonClasses } from '@vedere/ui';
import type { Producto } from '@/lib/types';
import { ProductCard } from '@/components/tienda/ProductCard';
import { useFavoritos } from './FavoritosProvider';
import { SinDatos } from './Tarjeta';

export function FavoritosGrid({ inicial, error }: { inicial: Producto[]; error?: boolean }) {
  const { ids, estado, cargar } = useFavoritos();
  const [items] = useState(inicial);

  useEffect(() => {
    void cargar(true);
  }, [cargar]);

  const visibles = estado === 'listo' ? items.filter((p) => ids.has(p.id)) : items;

  if (visibles.length === 0) {
    return (
      <SinDatos>
        {error ? (
          'No pudimos cargar tus favoritos. Probá de nuevo en un momento.'
        ) : (
          <>
            Todavía no guardaste favoritos. Tocá el corazón en cualquier anteojo para tenerlo acá.
            <span className="mt-4 block">
              <Link href="/sol" className={buttonClasses('secondary', 'sm')}>
                Ver anteojos de sol
              </Link>
            </span>
          </>
        )}
      </SinDatos>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 lg:grid-cols-3" data-testid="cuenta-favoritos">
      {visibles.map((p) => (
        <ProductCard key={p.id} producto={p} sizes="(min-width: 1024px) 25vw, 50vw" />
      ))}
    </div>
  );
}
