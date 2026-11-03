// Plan Rivedere: recambio de lentes cada N meses desde la última compra de recetado/multifocal, con cupón.
import Link from 'next/link';
import { formatFecha } from '@/lib/format';
import type { ResumenCuenta } from '@/lib/tienda/cuenta';
import { Tarjeta } from './Tarjeta';

export function PlanRivedere({ rivedere }: { rivedere: ResumenCuenta['rivedere'] | null }) {
  const meses = rivedere?.meses ?? 24;
  const anios = meses % 12 === 0 ? `${meses / 12} año${meses / 12 === 1 ? '' : 's'}` : `${meses} meses`;
  const pct = rivedere?.descuentoPct ?? 15;
  return (
    <Tarjeta
      titulo={
        <span className="flex items-center gap-2">
          Plan Rivedere <span className="rounded-full bg-sol/40 px-2 py-0.5 text-xs font-medium">Recambio</span>
        </span>
      }
      className="bg-gris-claro/60"
    >
      <p className="text-sm text-negro/80">
        Tu graduación cambia. Cada <strong>{anios}</strong> desde tu última compra de lentes recetados o multifocales te
        avisamos por email y te mandamos un cupón de <strong>{pct}% de descuento</strong> para renovarlos.
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-blanco p-4">
          <dt className="text-gris-texto">Última compra de recetados</dt>
          <dd className="mt-1 font-semibold" data-testid="rivedere-ultima">
            {rivedere?.ultimaCompraRecetado ? formatFecha(rivedere.ultimaCompraRecetado) : 'Todavía ninguna'}
          </dd>
        </div>
        <div className="rounded-2xl bg-blanco p-4">
          <dt className="text-gris-texto">Próximo aviso de recambio</dt>
          <dd className="mt-1 font-semibold" data-testid="rivedere-proximo">
            {rivedere?.proximoAviso ? formatFecha(rivedere.proximoAviso) : '—'}
          </dd>
        </div>
      </dl>
      {!rivedere?.ultimaCompraRecetado && (
        <p className="mt-4 text-sm text-gris-texto">
          Entrás al plan automáticamente con tu primera compra de{' '}
          <Link href="/recetados" className="underline underline-offset-4">
            recetados
          </Link>{' '}
          o{' '}
          <Link href="/multifocales" className="underline underline-offset-4">
            multifocales
          </Link>
          .
        </p>
      )}
    </Tarjeta>
  );
}
