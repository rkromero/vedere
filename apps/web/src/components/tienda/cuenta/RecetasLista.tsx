'use client';
// Recetas guardadas: lista con borrado (la API rechaza borrar una receta usada en un pedido).
import { useState } from 'react';
import Link from 'next/link';
import { Button, buttonClasses } from '@vedere/ui';
import type { Receta } from '@/lib/tienda/checkout';
import { mensajeError } from '@/lib/tienda/client';
import { cuentaApi } from '@/lib/tienda/cuenta';
import { SinDatos } from './Tarjeta';
import { RecetaResumen } from './RecetaResumen';

export function RecetasLista({ inicial, error: errorInicial }: { inicial: Receta[]; error?: boolean }) {
  const [items, setItems] = useState(inicial);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function borrar(id: string) {
    if (!window.confirm('¿Borrar esta receta de tu cuenta?')) return;
    setBorrando(id);
    setError(null);
    try {
      await cuentaApi.borrarReceta(id);
      setItems((xs) => xs.filter((r) => r.id !== id));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setBorrando(null);
    }
  }

  if (items.length === 0) {
    return (
      <SinDatos>
        {errorInicial
          ? 'No pudimos cargar tus recetas. Probá de nuevo en un momento.'
          : 'Todavía no guardaste ninguna receta. En el checkout, marcá «guardar en mi cuenta» y la vas a tener acá para tu próxima compra.'}
      </SinDatos>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
          {error}
        </p>
      )}
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((r) => (
          <li key={r.id} className="rounded-2xl border border-negro/10 p-4" data-testid="receta-item">
            <RecetaResumen receta={r} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/recetados?receta=${encodeURIComponent(r.id)}`} className={buttonClasses('secondary', 'sm')}>
                Comprar con esta receta
              </Link>
              <Button variant="ghost" size="sm" onClick={() => borrar(r.id)} loading={borrando === r.id}>
                Borrar
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-gris-texto">
        Cuando compres lentes recetados o multifocales, elegí &ldquo;usar una receta guardada&rdquo; en el checkout.
      </p>
    </div>
  );
}
