'use client';
// Checkout en cuatro pasos (datos → entrega → receta → pago) contra /checkout/*. El estado vive acá;
// cada paso es un formulario independiente. Al confirmar: alta de cuenta opcional, POST /checkout/pedidos,
// vaciado del carrito y redirección a Mercado Pago (initPoint) o a /gracias/<id>.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container, Skeleton, buttonClasses } from '@vedere/ui';
import { track } from '@/lib/analytics';
import type { ItemAnalytics } from '@/lib/analytics';
import { site } from '@/config/site';
import { useCart } from '@/lib/tienda/cart';
import { useComercial } from '@/lib/tienda/comercial';
import { TiendaApiError, mensajeError, tiendaApi } from '@/lib/tienda/client';
import { DIRECCION_VACIA, LINEAS_CON_RECETA, MODALIDAD_LABEL, METODO_PAGO_LABEL } from '@/lib/tienda/checkout';
import type { Cotizacion, DireccionGuardada, PedidoPublico, Receta } from '@/lib/tienda/checkout';
import type { CartItem } from '@/lib/tienda/types';
import { Paso } from './Paso';
import type { EstadoPaso } from './Paso';
import { Resumen } from './Resumen';
import { StepDatos } from './StepDatos';
import type { CuentaNueva, DatosContacto, UsuarioSesion } from './StepDatos';
import { StepEntrega } from './StepEntrega';
import type { Entrega } from './StepEntrega';
import { StepReceta } from './StepReceta';
import type { RecetaElegida } from './StepReceta';
import { StepPago } from './StepPago';
import type { Pago } from './StepPago';

const EMAIL_PEDIDO_KEY = (id: string) => `vedere_pedido_email_${id}`;

export function itemsAnalytics(items: CartItem[]): ItemAnalytics[] {
  return items.map((i) => ({
    item_id: i.sku || i.varianteId,
    item_name: i.nombre,
    item_variant: i.color,
    item_category: i.linea,
    price: i.precio,
    quantity: i.cantidad,
  }));
}

/** Reparte los errores de validación de la API (`datos.email`, `entrega.direccion.cp`, ...) por paso. */
function repartirErrores(porCampo: Record<string, string>) {
  const datos: Record<string, string> = {};
  const entrega: Record<string, string> = {};
  const receta: Record<string, string> = {};
  const pago: Record<string, string> = {};
  for (const [path, msg] of Object.entries(porCampo)) {
    const partes = path.split('.');
    const raiz = partes[0] ?? '';
    const resto = partes.slice(1).join('.');
    if (raiz === 'datos') datos[resto] = msg;
    else if (raiz === 'entrega') {
      if (partes[1] === 'direccion') entrega[partes.slice(2).join('.') || 'direccion'] = msg;
      else if (partes[1] === 'opticaId') entrega.optica = msg;
      else entrega[resto || 'modalidad'] = msg;
    } else if (raiz === 'receta') receta[partes[partes.length - 1] ?? 'receta'] = msg;
    else if (raiz === 'pago') pago[resto || 'metodo'] = msg;
    else pago[raiz] = msg;
  }
  return { datos, entrega, receta, pago };
}

function estadoPaso(n: number, actual: number, completos: Set<number>): EstadoPaso {
  if (n === actual) return 'activo';
  return completos.has(n) ? 'completo' : 'pendiente';
}

export function Checkout() {
  const router = useRouter();
  const config = useComercial();
  const { items, cupon, hidratado, vaciar } = useCart();

  const [paso, setPaso] = useState(1);
  const [completos, setCompletos] = useState<Set<number>>(new Set());
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [datos, setDatos] = useState<DatosContacto>({ email: '', nombre: '', dni: '', telefono: '' });
  const [cuenta, setCuenta] = useState<CuentaNueva>({ crear: false, password: '' });
  const [entrega, setEntrega] = useState<Entrega>({ modalidad: 'RETIRO_OPTICA', direccion: DIRECCION_VACIA, optica: null });
  const [receta, setReceta] = useState<RecetaElegida | null>(null);
  const [pago, setPago] = useState<Pago>({ metodo: null, notas: '' });
  const [guardadas, setGuardadas] = useState<DireccionGuardada[]>([]);
  const [recetasGuardadas, setRecetasGuardadas] = useState<Receta[]>([]);
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [errores, setErrores] = useState(() => repartirErrores({}));
  const trackeado = useRef(false);
  const cotizarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requiereReceta = useMemo(
    () => cotizacion?.requiereReceta ?? items.some((i) => i.conReceta || LINEAS_CON_RECETA.includes(i.linea)),
    [cotizacion, items],
  );
  const multifocal = items.some((i) => i.linea === 'MULTIFOCAL');
  const pasos = requiereReceta ? 4 : 3;
  const pasoPago = requiereReceta ? 4 : 3;

  // Sesión: prefill de datos y, si hay cuenta, direcciones y recetas guardadas (404 tolerado hasta que exista la API).
  const cargarCuenta = useCallback(async (u: UsuarioSesion) => {
    setUsuario(u);
    setDatos((d) => ({ ...d, email: d.email || u.email, nombre: d.nombre || u.nombre, telefono: d.telefono || (u.telefono ?? '') }));
    const [dirs, recs] = await Promise.all([
      tiendaApi.get<{ items: DireccionGuardada[] }>('/cuenta/direcciones').catch(() => ({ items: [] })),
      tiendaApi.get<{ items: Receta[] }>('/checkout/recetas').catch(() => ({ items: [] })),
    ]);
    setGuardadas(Array.isArray(dirs.items) ? dirs.items : []);
    setRecetasGuardadas(Array.isArray(recs.items) ? recs.items : []);
    const pred = (dirs.items ?? []).find((d) => d.predeterminada) ?? dirs.items?.[0];
    if (pred) {
      setEntrega((e) =>
        e.direccion.direccion
          ? e
          : {
              ...e,
              direccion: {
                direccion: pred.direccion,
                piso: pred.piso ?? '',
                localidad: pred.localidad,
                provincia: pred.provincia,
                codigoPostal: pred.codigoPostal,
                lat: pred.lat,
                lng: pred.lng,
                placeId: pred.placeId,
                direccionCompleta: null,
              },
            },
      );
      if (pred.telefono) setDatos((d) => ({ ...d, telefono: d.telefono || pred.telefono || '' }));
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    fetch('/api/session', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((s: { user: { id: string; email: string; nombre: string } | null }) => {
        if (!cancelado && s.user) void cargarCuenta({ ...s.user, telefono: null });
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [cargarCuenta]);

  // begin_checkout una sola vez, cuando el carrito está hidratado y tiene ítems.
  useEffect(() => {
    if (!hidratado || items.length === 0 || trackeado.current) return;
    trackeado.current = true;
    track('begin_checkout', {
      value: items.reduce((a, i) => a + i.precio * i.cantidad, 0),
      items: itemsAnalytics(items),
      coupon: cupon?.codigo,
    });
  }, [hidratado, items, cupon]);

  // Cotización con modalidad, medio de pago y email (descuento por transferencia, cupón por cliente).
  useEffect(() => {
    if (!hidratado || items.length === 0) {
      setCotizacion(null);
      return;
    }
    if (cotizarTimer.current) clearTimeout(cotizarTimer.current);
    let cancelado = false;
    cotizarTimer.current = setTimeout(() => {
      tiendaApi
        .post<Cotizacion>('/checkout/cotizar', {
          items: items.map((i) => ({ varianteId: i.varianteId, cantidad: i.cantidad, conReceta: i.conReceta })),
          cupon: cupon?.codigo ?? null,
          modalidad: entrega.modalidad,
          metodoPago: pago.metodo,
          email: datos.email || undefined,
        })
        .then((c) => {
          if (!cancelado) setCotizacion(c);
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      cancelado = true;
    };
  }, [hidratado, items, cupon, entrega.modalidad, pago.metodo, datos.email]);

  function completar(n: number) {
    setCompletos((s) => new Set(s).add(n));
    setPaso(n + 1);
  }

  const bloqueo = useMemo(() => {
    if (!cotizacion) return null;
    if (cotizacion.sinStock.length > 0) {
      const nombres = cotizacion.sinStock
        .map((s) => items.find((i) => i.varianteId === s.varianteId))
        .filter(Boolean)
        .map((i) => `${i!.nombre} (${i!.color})`);
      return `Sin stock suficiente de ${nombres.join(', ') || 'un producto'}. Ajustá las cantidades en el carrito.`;
    }
    return null;
  }, [cotizacion, items]);

  async function confirmar(p: Pago) {
    if (!entrega.optica || !p.metodo) return;
    setPago(p);
    setEnviando(true);
    setErrorGeneral(null);
    setErrores(repartirErrores({}));
    try {
      if (cuenta.crear && !usuario) {
        try {
          const r = await tiendaApi.post<{ user: UsuarioSesion }>('/auth/register', {
            email: datos.email,
            nombre: datos.nombre,
            telefono: datos.telefono || undefined,
            password: cuenta.password,
          });
          setUsuario(r.user);
          track('sign_up');
        } catch (err) {
          if (err instanceof TiendaApiError && err.status === 409) {
            setErrores({ ...repartirErrores({}), datos: { email: 'Ya existe una cuenta con ese email: ingresá o comprá como invitado.' } });
            setPaso(1);
            return;
          }
          throw err;
        }
      }
      const { direccion } = entrega;
      const r = await tiendaApi.post<{ pedido: PedidoPublico; initPoint: string | null }>('/checkout/pedidos', {
        datos,
        entrega: {
          modalidad: entrega.modalidad,
          opticaId: entrega.optica.id,
          direccion: {
            direccion: direccion.direccion,
            piso: direccion.piso || null,
            localidad: direccion.localidad,
            provincia: direccion.provincia,
            codigoPostal: direccion.codigoPostal,
            lat: direccion.lat,
            lng: direccion.lng,
            placeId: direccion.placeId,
            direccionCompleta: direccion.direccionCompleta,
          },
        },
        receta: requiereReceta && receta ? { ...receta.input, ...(receta.input.modo === 'GUARDADA' ? {} : { guardar: receta.guardar }) } : null,
        pago: { metodo: p.metodo },
        items: items.map((i) => ({ varianteId: i.varianteId, cantidad: i.cantidad, conReceta: i.conReceta })),
        cupon: cupon?.codigo ?? null,
        notas: p.notas || null,
      });
      try {
        sessionStorage.setItem(EMAIL_PEDIDO_KEY(r.pedido.id), datos.email);
      } catch {
        /* ignorar */
      }
      vaciar();
      if (r.initPoint) {
        window.location.assign(r.initPoint);
        return;
      }
      router.push(`/gracias/${r.pedido.id}`);
    } catch (err) {
      const porCampo = err instanceof TiendaApiError ? erroresDeDetalles(err) : {};
      const rep = repartirErrores(porCampo);
      setErrores(rep);
      if (Object.keys(rep.datos).length) setPaso(1);
      else if (Object.keys(rep.entrega).length) setPaso(2);
      else if (Object.keys(rep.receta).length && requiereReceta) setPaso(3);
      else setPaso(pasoPago);
      setErrorGeneral(Object.keys(porCampo).length ? 'Revisá los datos marcados.' : mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  if (!hidratado) {
    return (
      <Container className="py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </Container>
    );
  }

  if (items.length === 0) {
    return (
      <Container className="py-16 text-center">
        <p className="font-campaign text-5xl md:text-7xl">Tu carrito está vacío</p>
        <p className="font-text mt-4 text-gris-texto">Elegí tu modelo y tu color. Te lo ajustan en tu óptica más cercana.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/sol" className={buttonClasses('primary', 'md')}>
            Ver anteojos de sol
          </Link>
          <Link href="/recetados" className={buttonClasses('secondary', 'md')}>
            Ver recetados
          </Link>
        </div>
      </Container>
    );
  }

  const neto = cotizacion ? cotizacion.totales.subtotal - cotizacion.totales.descuentoTotal : items.reduce((a, i) => a + i.precio * i.cantidad, 0);

  return (
    <Container className="py-8 md:py-12">
      <h1 className="font-campaign text-5xl md:text-6xl">Finalizar compra</h1>
      <p className="font-text mt-2 text-gris-texto">
        {pasos} pasos. Pagás online y tu óptica socia arma, entrega y ajusta tu pedido.
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-4">
          <Paso
            numero={1}
            titulo="Tus datos"
            estado={estadoPaso(1, paso, completos)}
            onEditar={() => setPaso(1)}
            resumen={
              <p>
                {datos.nombre} · {datos.email} · DNI {datos.dni} · {datos.telefono}
              </p>
            }
          >
            <StepDatos
              valor={datos}
              errores={errores.datos}
              usuario={usuario}
              onUsuario={(u) => (u ? void cargarCuenta(u) : setUsuario(null))}
              cuenta={cuenta}
              onCuenta={setCuenta}
              onContinuar={(d) => {
                setDatos(d);
                completar(1);
              }}
            />
          </Paso>

          <Paso
            numero={2}
            titulo="Entrega"
            estado={estadoPaso(2, paso, completos)}
            onEditar={() => setPaso(2)}
            resumen={
              <p>
                {MODALIDAD_LABEL[entrega.modalidad]} · {entrega.direccion.direccion}, {entrega.direccion.localidad} ({entrega.direccion.codigoPostal})
                {entrega.optica && (
                  <>
                    <br />
                    Óptica socia: <strong>{entrega.optica.nombre}</strong>, {entrega.optica.direccion}
                  </>
                )}
              </p>
            }
          >
            <StepEntrega
              valor={entrega}
              errores={errores.entrega}
              places={config.places}
              costoEnvio={config.costoEnvio}
              envioGratis={neto >= site.comercial.envioGratisDesde}
              guardadas={guardadas}
              onContinuar={(e) => {
                setEntrega(e);
                completar(2);
              }}
            />
          </Paso>

          {requiereReceta && (
            <Paso
              numero={3}
              titulo="Tu receta"
              estado={estadoPaso(3, paso, completos)}
              onEditar={() => setPaso(3)}
              resumen={<p>{receta?.etiqueta}</p>}
            >
              <StepReceta
                valor={receta}
                errores={errores.receta}
                guardadas={recetasGuardadas}
                conSesion={!!usuario}
                multifocal={multifocal}
                onContinuar={(r) => {
                  setReceta(r);
                  completar(3);
                }}
              />
            </Paso>
          )}

          <Paso
            numero={pasoPago}
            titulo="Pago"
            estado={estadoPaso(pasoPago, paso, completos)}
            resumen={<p>{pago.metodo ? METODO_PAGO_LABEL[pago.metodo] : ''}</p>}
          >
            <StepPago
              valor={pago}
              errores={errores.pago}
              config={config}
              cotizacion={cotizacion}
              enviando={enviando}
              errorGeneral={errorGeneral}
              bloqueo={bloqueo}
              onConfirmar={confirmar}
            />
          </Paso>
        </div>

        <div className="lg:sticky lg:top-24">
          <Resumen items={items} cotizacion={cotizacion} modalidad={entrega.modalidad} />
          <p className="font-text mt-3 text-center text-xs text-gris-texto">
            ¿Querés cambiar algo?{' '}
            <Link href="/" className="underline underline-offset-4">
              Volver a la tienda
            </Link>
          </p>
        </div>
      </div>
    </Container>
  );
}

function erroresDeDetalles(err: TiendaApiError): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(err.details)) {
    for (const d of err.details as Array<{ path?: string; message: string }>) {
      if (d.path && !out[d.path]) out[d.path] = d.message;
    }
  }
  return out;
}
