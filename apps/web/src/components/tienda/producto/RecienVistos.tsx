'use client';
// "Vistos recientemente": lee los slugs del navegador y pide los productos a la API.
import { useEffect, useState } from 'react';
import { Container } from '@vedere/ui';
import { tiendaApi } from '@/lib/tienda/client';
import { leerRecientes } from '@/lib/tienda/recientes';
import type { Paged, Producto } from '@/lib/types';
import { Carousel } from '../Carousel';
import { ProductCard } from '../ProductCard';

export function RecienVistos({ excluirSlug }: { excluirSlug?: string }) {
  const [items, setItems] = useState<Producto[]>([]);

  useEffect(() => {
    const slugs = leerRecientes().filter((s) => s !== excluirSlug);
    if (slugs.length === 0) return;
    let cancelado = false;
    tiendaApi
      .get<Paged<Producto>>(`/catalogo/productos?slugs=${encodeURIComponent(slugs.join(','))}&pageSize=12`)
      .then((res) => {
        if (cancelado) return;
        const porSlug = new Map(res.items.map((p) => [p.slug, p]));
        setItems(slugs.map((s) => porSlug.get(s)).filter((p): p is Producto => !!p));
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [excluirSlug]);

  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recientes-titulo">
      <Container className="py-12">
        <h2 id="recientes-titulo" className="font-campaign mb-6 text-3xl md:text-4xl">
          Vistos recientemente
        </h2>
        <Carousel label="Productos vistos recientemente">
          {items.map((p) => (
            <ProductCard key={p.id} producto={p} sizes="(min-width: 1024px) 23vw, 70vw" />
          ))}
        </Carousel>
      </Container>
    </section>
  );
}
