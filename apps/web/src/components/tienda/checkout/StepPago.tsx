'use client';
// Paso 4: medio de pago, cupón, notas y confirmación. El cupón vive en el carrito (useCart.aplicarCupon)
// para que la cotización lo tome; el resumen de totales se muestra al costado (Resumen.tsx).
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Button, Field, Input, Textarea, cn, formatARS } from '@vedere/ui';
import { useCart } from '@/lib/tienda/cart';
import { mensajeError } from '@/lib/tienda/client';
import { METODO_PAGO_LABEL } from '@/lib/tienda/checkout';
import type { ConfigCheckout, Cotizacion, MetodoPago } from '@/lib/tienda/checkout';

export interface Pago {
  metodo: MetodoPago | null;
  notas: string;
}

function CuponCheckout() {
  const { cupon, aplicarCupon, quitarCupon, cotizacion } = useCart();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function aplicar(e: FormEvent) {
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
    const motivo = cotizacion?.cuponError ?? null;
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-vetro/25 px-4 py-3 text-sm">
        <p>
          Cupón <span className="font-semibold">{cupon.codigo}</span>
          {cupon.descripcion && <span className="text-gris-texto"> · {cupon.descripcion}</span>}
          {motivo && <span className="block text-xs text-carey">{motivo}</span>}
        </p>
        <button type="button" onClick={quitarCupon} className="shrink-0 underline underline-offset-4">
          Quitar
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={aplicar} className="flex gap-2" noValidate>
      <Field label="Cupón de descuento" hideLabel error={error ?? undefined} className="min-w-0 flex-1">
        {(p) => (
          <Input {...p} value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Cupón de descuento" autoComplete="off" className="uppercase placeholder:normal-case" data-testid="checkout-cupon" />
        )}
      </Field>
      <Button type="submit" variant="secondary" size="md" loading={cargando} className="shrink-0">
        Aplicar
      </Button>
    </form>
  );
}

export function StepPago({
  valor,
  errores,
  config,
  cotizacion,
  enviando,
  errorGeneral,
  bloqueo,
  onConfirmar,
}: {
  valor: Pago;
  errores: Record<string, string>;
  config: ConfigCheckout;
  cotizacion: Cotizacion | null;
  enviando: boolean;
  errorGeneral: string | null;
  /** Motivo por el que no se puede confirmar (sin stock, etc.). */
  bloqueo: string | null;
  onConfirmar: (p: Pago) => void;
}) {
  const [metodo, setMetodo] = useState<MetodoPago | null>(valor.metodo);
  const [notas, setNotas] = useState(valor.notas);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const metodos: Array<{ metodo: MetodoPago; detalle: string }> = [];
  if (config.mercadoPago) {
    metodos.push({
      metodo: 'MERCADO_PAGO',
      detalle: cotizacion
        ? `Tarjetas de crédito y débito · ${cotizacion.cuotas.cantidad} cuotas sin interés de ${formatARS(cotizacion.cuotas.valorCuota)}`
        : 'Tarjetas de crédito y débito en cuotas sin interés',
    });
  }
  if (config.mercadoPagoBilletera) metodos.push({ metodo: 'MERCADO_PAGO_BILLETERA', detalle: 'Pagá con tu saldo o QR desde la app de Mercado Pago.' });
  if (config.transferencia) {
    metodos.push({
      metodo: 'TRANSFERENCIA',
      detalle: `${config.transferencia.descuento > 0 ? `${config.transferencia.descuento}% de descuento. ` : ''}Te pasamos el CBU y reservamos el stock ${config.transferencia.horasReserva} h.`,
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!metodo) {
      setLocalErr('Elegí cómo pagar');
      return;
    }
    setLocalErr(null);
    onConfirmar({ metodo, notas: notas.trim() });
  }

  const err: Record<string, string> = { ...errores, ...(localErr ? { metodo: localErr } : {}) };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <fieldset>
        <legend className="mb-3 text-sm font-medium">Medio de pago</legend>
        {metodos.length === 0 ? (
          <p className="rounded-xl bg-sol/30 px-4 py-3 text-sm">
            El pago online no está disponible en este momento. Escribinos por{' '}
            <Link href="/contacto" className="underline underline-offset-4">
              contacto
            </Link>{' '}
            y lo resolvemos.
          </p>
        ) : (
          <div className="space-y-3">
            {metodos.map((m) => {
              const activo = metodo === m.metodo;
              return (
                <label
                  key={m.metodo}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors',
                    activo ? 'border-negro bg-gris-claro' : 'border-negro/15 hover:border-negro/40',
                  )}
                >
                  <input
                    type="radio"
                    name="metodo-pago"
                    value={m.metodo}
                    checked={activo}
                    onChange={() => setMetodo(m.metodo)}
                    className="mt-1 h-4 w-4 shrink-0 accent-negro"
                    data-testid={`pago-${m.metodo}`}
                  />
                  <span>
                    <span className="block font-medium">{METODO_PAGO_LABEL[m.metodo]}</span>
                    <span className="mt-0.5 block text-sm text-gris-texto">{m.detalle}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {err.metodo && (
          <p role="alert" className="mt-2 text-sm text-carey">
            {err.metodo}
          </p>
        )}
      </fieldset>

      <CuponCheckout />

      <Field label="Notas para la óptica (opcional)" error={err.notas}>
        {(p) => <Textarea {...p} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} className="min-h-[80px]" placeholder="Ej. horario para que me llamen, referencia de la casa…" />}
      </Field>

      {bloqueo && (
        <p role="alert" className="rounded-xl bg-carey/15 px-4 py-3 text-sm text-carey">
          {bloqueo}
        </p>
      )}
      {errorGeneral && (
        <p role="alert" className="rounded-xl bg-carey/15 px-4 py-3 text-sm text-carey">
          {errorGeneral}
        </p>
      )}

      <div className="space-y-3">
        <Button type="submit" size="lg" className="w-full" loading={enviando} disabled={!!bloqueo || metodos.length === 0} data-testid="checkout-confirmar">
          {metodo === 'TRANSFERENCIA' ? 'Confirmar pedido' : metodo ? 'Ir a pagar' : 'Confirmar pedido'}
          {cotizacion && ` · ${formatARS(cotizacion.totales.total)}`}
        </Button>
        <p className="text-xs text-gris-texto">
          Al confirmar aceptás los{' '}
          <Link href="/legal/terminos" className="underline underline-offset-4">
            términos y condiciones
          </Link>{' '}
          y la{' '}
          <Link href="/legal/privacidad" className="underline underline-offset-4">
            política de privacidad
          </Link>
          . Tenés 10 días para arrepentirte de la compra sin costo.
        </p>
      </div>
    </form>
  );
}
