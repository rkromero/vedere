'use client';
// Carrito lateral: cantidades, cupón, subtotal, cuotas y progreso hacia el envío gratis.
import { useState } from 'react';
import type { FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Button,
  Drawer,
  IconMinus,
  IconPlus,
  IconTrash,
  buttonClasses,
  cuotas,
  formatARS,
} from '@vedere/ui';
import { site } from '@/config/site';
import { useCart } from '@/lib/tienda/cart';
import { mensajeError } from '@/lib/tienda/client';
import type { CartItem } from '@/lib/tienda/types';

function Linea({ item }: { item: CartItem }) {
  const { setCantidad, quitar, setReceta } = useCart();
  const sinStock = item.stock <= 0;
  return (
    <li className="flex gap-3 py-4">
      <Link
        href={`/p/${item.slug}?v=${item.varianteId}`}
        className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gris-claro"
      >
        {item.imagen && (
          <Image src={item.imagen} alt="" fill sizes="96px" className="object-cover" />
        )}
      </Link>
      <div className="font-text min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/p/${item.slug}?v=${item.varianteId}`} className="block truncate font-medium">
              {item.nombre}
            </Link>
            <p className="flex items-center gap-1.5 text-sm text-gris-texto">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-full border border-negro/15"
                style={{ backgroundColor: item.colorHex ?? '#8A8A86' }}
              />
              {item.color}
              {item.conReceta && ' · con receta'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => quitar(item.varianteId)}
            aria-label={`Quitar ${item.nombre} ${item.color}`}
            className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gris-texto hover:bg-negro/5 hover:text-negro"
          >
            <IconTrash size={18} />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div
            className="inline-flex h-10 items-center rounded-full border border-negro/15"
            role="group"
            aria-label={`Cantidad de ${item.nombre}`}
          >
            <button
              type="button"
              onClick={() => setCantidad(item.varianteId, item.cantidad - 1)}
              aria-label="Restar uno"
              className="inline-flex h-10 w-10 items-center justify-center rounded-l-full hover:bg-negro/5"
            >
              <IconMinus size={16} />
            </button>
            <span className="w-8 text-center text-sm font-medium" aria-live="polite">
              {item.cantidad}
            </span>
            <button
              type="button"
              onClick={() => setCantidad(item.varianteId, item.cantidad + 1)}
              disabled={item.cantidad >= Math.min(item.stock, 10)}
              aria-label="Sumar uno"
              className="inline-flex h-10 w-10 items-center justify-center rounded-r-full hover:bg-negro/5 disabled:opacity-40"
            >
              <IconPlus size={16} />
            </button>
          </div>
          <p className="text-right">
            <span className="block font-semibold">{formatARS(item.precio * item.cantidad)}</span>
            {item.precioLista && item.precioLista > item.precio && (
              <s className="block text-xs text-gris-texto">
                {formatARS(item.precioLista * item.cantidad)}
              </s>
            )}
          </p>
        </div>
        {item.linea !== 'SOL' && item.linea !== 'ACCESORIO' && (
          <label className="mt-2 inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.conReceta}
              onChange={(e) => setReceta(item.varianteId, e.target.checked)}
              className="h-4 w-4 accent-negro"
            />
            Usar con mi receta
          </label>
        )}
        {sinStock && <p className="mt-1 text-xs text-carey">Sin stock por ahora.</p>}
      </div>
    </li>
  );
}

function Cupon() {
  const { cupon, aplicarCupon, quitarCupon, totales } = useCart();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    setCargando(true);
    setError(null);
    try {
      await aplicarCupon(codigo);
      setCodigo('');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  if (cupon) {
    const aplica = !cupon.minimoCompra || totales.subtotal >= cupon.minimoCompra;
    const motivo = totales.cuponError ?? (!aplica ? `Aplica desde ${formatARS(cupon.minimoCompra ?? 0)}.` : null);
    return (
      <div className="font-text flex items-center justify-between gap-3 rounded-xl bg-vetro/25 px-3 py-2 text-sm">
        <p>
          <span className="font-semibold">{cupon.codigo}</span>
          {cupon.descripcion && <span className="text-gris-texto"> · {cupon.descripcion}</span>}
          {motivo && <span className="block text-xs text-carey">{motivo}</span>}
        </p>
        <button type="button" onClick={quitarCupon} className="shrink-0 text-sm underline underline-offset-4">
          Quitar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="font-text">
      <label htmlFor="cupon" className="sr-only">
        Cupón de descuento
      </label>
      <div className="flex gap-2">
        <input
          id="cupon"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="Cupón de descuento"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'cupon-error' : undefined}
          className="h-11 min-w-0 flex-1 rounded-full border border-negro/15 px-4 text-sm uppercase placeholder:normal-case placeholder:text-gris-texto focus:border-negro focus:outline-none"
        />
        <Button type="submit" variant="secondary" size="sm" loading={cargando} className="h-11">
          Aplicar
        </Button>
      </div>
      {error && (
        <p id="cupon-error" role="alert" className="mt-1.5 text-xs text-carey">
          {error}
        </p>
      )}
    </form>
  );
}

function ProgresoEnvio() {
  const { totales } = useCart();
  const pct = Math.round(totales.progresoEnvio * 100);
  return (
    <div className="font-text" aria-live="polite">
      <p className="mb-1.5 text-sm">
        {totales.envioGratis ? (
          <span className="font-medium">¡Tenés envío gratis! 🎉</span>
        ) : (
          <>
            Te faltan <span className="font-semibold">{formatARS(totales.faltaParaEnvioGratis)}</span>{' '}
            para el envío gratis.
          </>
        )}
      </p>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-negro/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Progreso hacia el envío gratis"
      >
        <div
          className="h-full rounded-full bg-vetro transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CartDrawer() {
  const { abierto, cerrar, items, totales, hidratado } = useCart();
  const vacio = items.length === 0;
  const textoCuotas = totales.cuotas
    ? `${totales.cuotas.cantidad} cuotas sin interés de ${formatARS(totales.cuotas.valorCuota)}`
    : cuotas(totales.total, site.comercial.cuotas).texto;

  return (
    <Drawer
      open={abierto}
      onClose={cerrar}
      title="Tu carrito"
      headerExtra={
        totales.cantidad > 0 ? (
          <span className="font-text text-sm text-gris-texto">
            {totales.cantidad} {totales.cantidad === 1 ? 'producto' : 'productos'}
          </span>
        ) : null
      }
      footer={
        !vacio ? (
          <div className="font-text space-y-3">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gris-texto">Subtotal</dt>
                <dd>{formatARS(totales.subtotal)}</dd>
              </div>
              {totales.descuentos.map((d) => (
                <div key={`${d.tipo}-${d.id ?? d.codigo ?? d.descripcion}`} className="flex justify-between gap-3 text-noche">
                  <dt className="truncate">{d.descripcion}</dt>
                  <dd className="shrink-0">−{formatARS(d.monto)}</dd>
                </div>
              ))}
              <div className="flex justify-between">
                <dt className="text-gris-texto">Envío</dt>
                <dd>{totales.envioGratis ? 'Gratis' : 'Se calcula al finalizar'}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-1 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="text-lg font-semibold">{formatARS(totales.total)}</dd>
              </div>
            </dl>
            {totales.ahorro > 0 && (
              <p className="rounded-xl bg-sol/30 px-3 py-2 text-sm font-medium">
                Ahorrás {formatARS(totales.ahorro)} en esta compra
              </p>
            )}
            <p className="text-sm text-gris-texto">{textoCuotas} con tarjetas bancarias.</p>
            <Link href="/checkout" className={buttonClasses('primary', 'lg', 'w-full')}>
              Iniciar compra
            </Link>
            <button
              type="button"
              onClick={cerrar}
              className="block w-full py-2 text-center text-sm underline underline-offset-4"
            >
              Seguir comprando
            </button>
          </div>
        ) : undefined
      }
    >
      {!hidratado ? null : vacio ? (
        <div className="font-text flex flex-col items-start gap-4 py-6">
          <p className="font-campaign text-4xl">
            Todavía
            <br />
            no hay nada
          </p>
          <p className="text-gris-texto">
            Elegí tu modelo y tu color. Te lo ajustan en tu óptica más cercana.
          </p>
          <Link href="/sol" onClick={cerrar} className={buttonClasses('primary', 'md')}>
            Ver anteojos de sol
          </Link>
          <Link href="/recetados" onClick={cerrar} className={buttonClasses('secondary', 'md')}>
            Ver recetados
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <ProgresoEnvio />
          <ul className="divide-y divide-negro/10" aria-label="Productos en el carrito">
            {items.map((item) => (
              <Linea key={item.varianteId} item={item} />
            ))}
          </ul>
          <Cupon />
        </div>
      )}
    </Drawer>
  );
}
