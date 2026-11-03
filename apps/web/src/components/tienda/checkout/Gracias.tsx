'use client';
// Página de gracias: carga el pedido (/checkout/pedidos/:id, con el email guardado al confirmar si no hay
// sesión), muestra estado y seguimiento, datos de transferencia + comprobante, sincroniza el pago con
// Mercado Pago al volver (?status=) y dispara `purchase` una sola vez por pedido.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Container, Skeleton, buttonClasses, formatARS } from '@vedere/ui';
import { track } from '@/lib/analytics';
import { formatFecha } from '@/lib/format';
import { useComercial } from '@/lib/tienda/comercial';
import { mensajeError, tiendaApi } from '@/lib/tienda/client';
import type { PedidoPublico } from '@/lib/tienda/checkout';
import { DatosEntrega, EstadoPedidoBadge, ItemsPedido, OpticaPedido, RecetaPedido, TimelinePedido } from './PedidoResumenCliente';

const EMAIL_KEY = (id: string) => `vedere_pedido_email_${id}`;
const PURCHASE_KEY = (id: string) => `vedere_purchase_${id}`;

function leer(storage: Storage | undefined, k: string): string | null {
  try {
    return storage?.getItem(k) ?? null;
  } catch {
    return null;
  }
}

function Copiable({ label, valor }: { label: string; valor: string }) {
  const [ok, setOk] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch {
      /* sin clipboard */
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-gris-texto">{label}</p>
        <p className="truncate font-mono text-sm font-medium">{valor}</p>
      </div>
      <button type="button" onClick={copiar} className="shrink-0 text-sm underline underline-offset-4">
        {ok ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

function Transferencia({ pedido, onActualizado }: { pedido: PedidoPublico; onActualizado: (p: Partial<PedidoPublico>) => void }) {
  const config = useComercial();
  const t = config.transferencia;
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const yaSubido = !!pedido.pago?.comprobanteUrl;

  async function subir(file: File | undefined) {
    if (!file) return;
    setSubiendo(true);
    setError(null);
    try {
      const r = await tiendaApi.upload<{ ok: boolean; comprobanteUrl: string }>(`/checkout/pedidos/${pedido.id}/comprobante`, file);
      onActualizado({
        pago: {
          ...(pedido.pago ?? { id: '', estado: 'PENDIENTE', proveedor: 'transferencia', preferenciaId: null }),
          comprobanteUrl: r.comprobanteUrl,
          comprobanteNombre: file.name,
          comprobanteSubidoEn: new Date().toISOString(),
        },
      });
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setSubiendo(false);
    }
  }

  if (pedido.estadoPago === 'APROBADO') {
    return <p className="font-text rounded-xl bg-vetro/25 px-4 py-3 text-sm">Transferencia confirmada. ¡Gracias!</p>;
  }

  return (
    <div className="font-text space-y-4 rounded-2xl border border-sol bg-sol/15 p-5" data-testid="gracias-transferencia">
      <div>
        <h2 className="text-lg font-semibold">Transferí {formatARS(pedido.totales.total)} para confirmar tu pedido</h2>
        <p className="mt-1 text-sm text-negro/80">
          Reservamos el stock{pedido.reservaExpiraEn ? ` hasta el ${formatFecha(pedido.reservaExpiraEn, true)}` : ''}. Cuando acreditamos el pago, tu óptica socia empieza a armarlo.
        </p>
      </div>
      {t ? (
        <div className="divide-y divide-negro/10 rounded-xl bg-blanco px-4">
          {t.alias && <Copiable label="Alias" valor={t.alias} />}
          {t.cbu && <Copiable label="CBU / CVU" valor={t.cbu} />}
          {t.titular && <Copiable label="Titular" valor={t.titular} />}
          {t.banco && (
            <div className="py-2">
              <p className="text-xs text-gris-texto">Banco</p>
              <p className="text-sm font-medium">{t.banco}</p>
            </div>
          )}
          <Copiable label="Referencia" valor={pedido.numero} />
        </div>
      ) : (
        <p className="text-sm">Te mandamos los datos de la cuenta por email.</p>
      )}
      <div className="space-y-2">
        <p className="text-sm font-medium">{yaSubido ? 'Comprobante recibido' : 'Subí el comprobante'}</p>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => subir(e.target.files?.[0])} data-testid="gracias-comprobante" />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant={yaSubido ? 'secondary' : 'primary'} size="sm" loading={subiendo} onClick={() => fileRef.current?.click()}>
            {yaSubido ? 'Reemplazar comprobante' : 'Adjuntar comprobante'}
          </Button>
          {yaSubido && <span className="text-sm text-gris-texto">{pedido.pago?.comprobanteNombre ?? 'Archivo subido'}</span>}
        </div>
        {error && (
          <p role="alert" className="text-sm text-carey">
            {error}
          </p>
        )}
        <p className="text-xs text-gris-texto">Lo revisamos en horario comercial y te confirmamos por email.</p>
      </div>
    </div>
  );
}

export function Gracias({ id, status }: { id: string; status?: string }) {
  const [pedido, setPedido] = useState<PedidoPublico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [conSesion, setConSesion] = useState(false);
  const purchaseEnviado = useRef(false);

  const cargar = useCallback(async () => {
    const email = leer(typeof window === 'undefined' ? undefined : window.sessionStorage, EMAIL_KEY(id));
    const q = email ? `?email=${encodeURIComponent(email)}` : '';
    return tiendaApi.get<PedidoPublico>(`/checkout/pedidos/${id}${q}`);
  }, [id]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        let p = await cargar();
        if (p.metodoPago !== 'TRANSFERENCIA' && p.estadoPago !== 'APROBADO') {
          setSincronizando(true);
          try {
            p = await tiendaApi.post<PedidoPublico>(`/checkout/pedidos/${id}/sincronizar-pago`);
          } catch {
            /* se muestra el estado actual */
          }
          setSincronizando(false);
        }
        if (!cancelado) setPedido(p);
      } catch (err) {
        if (!cancelado) setError(mensajeError(err));
      }
    })();
    fetch('/api/session', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((s: { user: unknown }) => !cancelado && setConSesion(!!s.user))
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [cargar, id]);

  // purchase: una sola vez por pedido (localStorage), con event_id para deduplicar con la Conversions API.
  useEffect(() => {
    if (!pedido || purchaseEnviado.current) return;
    purchaseEnviado.current = true;
    if (leer(window.localStorage, PURCHASE_KEY(pedido.id))) return;
    track(
      'purchase',
      {
        transaction_id: pedido.numero,
        value: pedido.totales.total,
        shipping: pedido.totales.envio,
        coupon: pedido.cuponCodigo ?? undefined,
        items: pedido.items.map((i) => ({
          item_id: i.sku || i.varianteId || i.id,
          item_name: i.nombre,
          item_variant: i.color,
          item_category: i.linea,
          price: i.precioUnitario,
          quantity: i.cantidad,
        })),
      },
      `purchase-${pedido.id}`,
    );
    try {
      window.localStorage.setItem(PURCHASE_KEY(pedido.id), new Date().toISOString());
    } catch {
      /* ignorar */
    }
  }, [pedido]);

  async function sincronizar() {
    setSincronizando(true);
    try {
      setPedido(await tiendaApi.post<PedidoPublico>(`/checkout/pedidos/${id}/sincronizar-pago`));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setSincronizando(false);
    }
  }

  if (error) {
    return (
      <Container className="py-16">
        <p className="font-campaign text-5xl">No encontramos el pedido</p>
        <p className="font-text mt-4 text-gris-texto">{error}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/pedido" className={buttonClasses('primary', 'md')}>
            Buscar mi pedido
          </Link>
          <Link href="/ingresar" className={buttonClasses('secondary', 'md')}>
            Ingresar a mi cuenta
          </Link>
        </div>
      </Container>
    );
  }

  if (!pedido) {
    return (
      <Container className="py-16">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-6 h-40 w-full" />
      </Container>
    );
  }

  const mp = pedido.metodoPago !== 'TRANSFERENCIA';
  const aprobado = pedido.estadoPago === 'APROBADO';
  const rechazado = pedido.estadoPago === 'RECHAZADO' || status === 'failure';
  const nombre = pedido.cliente.nombre.split(' ')[0] || pedido.cliente.nombre;

  return (
    <>
      <section className="bg-gris-claro">
        <Container className="py-10 md:py-14">
          <p className="font-text text-sm uppercase tracking-wide text-gris-texto">
            Pedido <span className="font-semibold text-negro" data-testid="gracias-numero">{pedido.numero}</span>
          </p>
          <h1 className="font-campaign mt-2 text-5xl md:text-7xl">
            {aprobado ? `¡Gracias, ${nombre}!` : rechazado ? 'El pago no se acreditó' : mp ? 'Estamos esperando tu pago' : `¡Casi listo, ${nombre}!`}
          </h1>
          <p className="font-text mt-4 max-w-2xl text-lg text-negro/75">
            {aprobado
              ? 'Recibimos tu pago. Te mandamos la confirmación por email y te avisamos en cada paso.'
              : rechazado
                ? 'Mercado Pago rechazó el pago. Podés intentar de nuevo con otro medio.'
                : mp
                  ? 'Mercado Pago todavía no confirmó el pago. Si ya pagaste, puede demorar unos minutos.'
                  : 'Te mandamos un email con los datos para transferir. El pedido queda reservado hasta que acreditemos el pago.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <EstadoPedidoBadge pedido={pedido} />
            {mp && !aprobado && (
              <Button type="button" variant="secondary" size="sm" loading={sincronizando} onClick={sincronizar} data-testid="gracias-sincronizar">
                Actualizar estado del pago
              </Button>
            )}
          </div>
        </Container>
      </section>

      <Container className="grid gap-8 py-10 md:py-14 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {!mp && <Transferencia pedido={pedido} onActualizado={(p) => setPedido({ ...pedido, ...p })} />}
          <section className="rounded-2xl border border-negro/10 p-5">
            <h2 className="font-text text-lg font-semibold">Seguimiento</h2>
            <div className="mt-4">
              <TimelinePedido pedido={pedido} />
            </div>
          </section>
          <div className="grid gap-6 sm:grid-cols-2">
            <section className="rounded-2xl border border-negro/10 p-5">
              <h2 className="font-text text-lg font-semibold">{pedido.entrega.modalidad === 'RETIRO_OPTICA' ? 'Retirás en' : 'Tu óptica socia'}</h2>
              <div className="mt-3">
                <OpticaPedido pedido={pedido} />
              </div>
            </section>
            <section className="rounded-2xl border border-negro/10 p-5">
              <h2 className="font-text text-lg font-semibold">{pedido.entrega.modalidad === 'RETIRO_OPTICA' ? 'Tus datos' : 'Enviamos a'}</h2>
              <div className="mt-3">
                <DatosEntrega pedido={pedido} />
                <p className="font-text mt-2 text-sm text-gris-texto">
                  {pedido.cliente.nombre} · DNI {pedido.cliente.dni}
                  <br />
                  {pedido.cliente.email} · {pedido.cliente.telefono}
                </p>
              </div>
            </section>
            {pedido.receta && (
              <section className="rounded-2xl border border-negro/10 p-5 sm:col-span-2">
                <h2 className="font-text text-lg font-semibold">Tu receta</h2>
                <div className="mt-3">
                  <RecetaPedido pedido={pedido} />
                </div>
              </section>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {conSesion ? (
              <Link href={`/mi-cuenta/pedidos/${pedido.id}`} className={buttonClasses('primary', 'md')} data-testid="gracias-mi-cuenta">
                Ver en Mi cuenta
              </Link>
            ) : (
              <Link href={`/ingresar?next=${encodeURIComponent(`/mi-cuenta/pedidos/${pedido.id}`)}`} className={buttonClasses('primary', 'md')}>
                Seguir el pedido en Mi cuenta
              </Link>
            )}
            <Link href="/" className={buttonClasses('secondary', 'md')}>
              Volver a la tienda
            </Link>
          </div>
        </div>
        <aside className="lg:sticky lg:top-24">
          <div className="rounded-2xl border border-negro/10 p-5">
            <h2 className="font-text text-lg font-semibold">Tu pedido</h2>
            <div className="mt-3">
              <ItemsPedido pedido={pedido} />
            </div>
            <p className="font-text mt-3 text-xs text-gris-texto">
              Realizado el {formatFecha(pedido.createdAt, true)}. ¿Dudas? Respondé el email de confirmación o escribinos por{' '}
              <Link href="/contacto" className="underline underline-offset-4">
                contacto
              </Link>
              .
            </p>
          </div>
        </aside>
      </Container>
    </>
  );
}
