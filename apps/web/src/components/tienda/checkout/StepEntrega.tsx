'use client';
// Paso 2: entrega. Modalidad (retiro en óptica socia o envío a domicilio), dirección (manual o con
// autocompletado de Google Places si la API lo habilita, o una guardada en la cuenta) y la óptica socia
// que atiende el pedido según la dirección (GET /checkout/optica).
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Field, IconPin, IconTruck, Input, Select, Spinner, cn, formatARS } from '@vedere/ui';
import { mensajeError, tiendaApi } from '@/lib/tienda/client';
import { MODALIDAD_LABEL, PROVINCIAS } from '@/lib/tienda/checkout';
import type {
  DireccionCheckout,
  DireccionGuardada,
  DireccionNormalizada,
  Modalidad,
  OpticaAsignada,
  SugerenciaDireccion,
} from '@/lib/tienda/checkout';

export interface Entrega {
  modalidad: Modalidad;
  direccion: DireccionCheckout;
  optica: OpticaAsignada | null;
}

function sessionToken(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
}

function direccionCompleta(d: DireccionCheckout): boolean {
  return d.direccion.trim().length >= 3 && d.localidad.trim().length >= 2 && d.provincia.trim().length >= 2 && /^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/.test(d.codigoPostal.trim());
}

export function StepEntrega({
  valor,
  errores,
  places,
  costoEnvio,
  envioGratis,
  guardadas,
  onContinuar,
}: {
  valor: Entrega;
  errores: Record<string, string>;
  places: boolean;
  costoEnvio: number;
  envioGratis: boolean;
  /** Direcciones guardadas en la cuenta (vacío si no hay sesión o la API no las tiene aún). */
  guardadas: DireccionGuardada[];
  onContinuar: (e: Entrega) => void;
}) {
  const [modalidad, setModalidad] = useState<Modalidad>(valor.modalidad);
  const [dir, setDir] = useState<DireccionCheckout>(valor.direccion);
  const [optica, setOptica] = useState<OpticaAsignada | null>(valor.optica);
  const [buscandoOptica, setBuscandoOptica] = useState(false);
  const [errorOptica, setErrorOptica] = useState<string | null>(null);
  const [localErr, setLocalErr] = useState<Record<string, string>>({});
  const [guardadaId, setGuardadaId] = useState<string>('');

  // Autocompletado
  const [query, setQuery] = useState(valor.direccion.direccionCompleta ?? '');
  const [sugerencias, setSugerencias] = useState<SugerenciaDireccion[]>([]);
  const [buscandoDir, setBuscandoDir] = useState(false);
  const [manual, setManual] = useState(!places || !!valor.direccion.direccion);
  const token = useRef(sessionToken());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: keyof DireccionCheckout) => (e: { target: { value: string } }) =>
    setDir((d) => ({ ...d, [k]: e.target.value, ...(k !== 'piso' ? { lat: null, lng: null, placeId: null, direccionCompleta: null } : {}) }));

  // Buscar la óptica cuando la dirección queda completa (por coordenadas si las hay, si no por CP).
  const claveOptica = direccionCompleta(dir) ? `${dir.lat ?? ''}|${dir.lng ?? ''}|${dir.codigoPostal.trim().toUpperCase()}` : '';
  useEffect(() => {
    if (!claveOptica) {
      setOptica(null);
      return;
    }
    let cancelado = false;
    setBuscandoOptica(true);
    setErrorOptica(null);
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams();
        if (dir.lat !== null && dir.lng !== null) {
          qs.set('lat', String(dir.lat));
          qs.set('lng', String(dir.lng));
        }
        qs.set('cp', dir.codigoPostal.trim().toUpperCase().replace(/\D/g, '').slice(0, 4) || dir.codigoPostal.trim());
        const o = await tiendaApi.get<OpticaAsignada>(`/checkout/optica?${qs.toString()}`);
        if (!cancelado) setOptica(o);
      } catch (err) {
        if (!cancelado) {
          setOptica(null);
          setErrorOptica(mensajeError(err));
        }
      } finally {
        if (!cancelado) setBuscandoOptica(false);
      }
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveOptica]);

  function buscarSugerencias(texto: string) {
    setQuery(texto);
    if (timer.current) clearTimeout(timer.current);
    if (texto.trim().length < 3) {
      setSugerencias([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setBuscandoDir(true);
      try {
        const r = await tiendaApi.get<{ habilitado: boolean; items: SugerenciaDireccion[] }>(
          `/checkout/direcciones?q=${encodeURIComponent(texto.trim())}&session=${token.current}`,
        );
        setSugerencias(r.items ?? []);
      } catch {
        setSugerencias([]);
      } finally {
        setBuscandoDir(false);
      }
    }, 300);
  }

  async function elegirSugerencia(s: SugerenciaDireccion) {
    setSugerencias([]);
    setQuery(s.descripcion);
    setBuscandoDir(true);
    try {
      const r = await tiendaApi.post<{ habilitado: boolean; direccion: DireccionNormalizada | null }>(
        '/checkout/direcciones/geocodificar',
        { placeId: s.placeId, session: token.current },
      );
      token.current = sessionToken();
      const n = r.direccion;
      if (!n) throw new Error('No pudimos ubicar esa dirección');
      setDir((d) => ({
        ...d,
        direccion: [n.calle, n.numero].filter(Boolean).join(' ') || s.principal,
        localidad: n.localidad || d.localidad,
        provincia: n.provincia || d.provincia,
        codigoPostal: n.codigoPostal || d.codigoPostal,
        lat: n.lat,
        lng: n.lng,
        placeId: n.placeId,
        direccionCompleta: n.direccionCompleta,
      }));
      setManual(true);
    } catch (err) {
      setLocalErr({ direccion: mensajeError(err) });
      setManual(true);
    } finally {
      setBuscandoDir(false);
    }
  }

  function usarGuardada(id: string) {
    setGuardadaId(id);
    const g = guardadas.find((x) => x.id === id);
    if (!g) return;
    setDir({
      direccion: g.direccion,
      piso: g.piso ?? '',
      localidad: g.localidad,
      provincia: g.provincia,
      codigoPostal: g.codigoPostal,
      lat: g.lat,
      lng: g.lng,
      placeId: g.placeId,
      direccionCompleta: null,
    });
    setManual(true);
  }

  function validar(): boolean {
    const err: Record<string, string> = {};
    if (dir.direccion.trim().length < 3) err.direccion = 'Ingresá calle y número';
    if (dir.localidad.trim().length < 2) err.localidad = 'Ingresá la localidad';
    if (dir.provincia.trim().length < 2) err.provincia = 'Elegí la provincia';
    if (!/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/.test(dir.codigoPostal.trim())) err.codigoPostal = 'Código postal inválido (ej. 1425 o C1425ABC)';
    if (!optica) err.optica = 'Esperá a que ubiquemos tu óptica socia';
    setLocalErr(err);
    return Object.keys(err).length === 0;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validar() || !optica) return;
    onContinuar({
      modalidad,
      direccion: { ...dir, direccion: dir.direccion.trim(), localidad: dir.localidad.trim(), provincia: dir.provincia.trim(), codigoPostal: dir.codigoPostal.trim().toUpperCase() },
      optica,
    });
  }

  const err = { ...localErr, ...errores };
  const retiro = modalidad === 'RETIRO_OPTICA';

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <fieldset>
        <legend className="mb-3 text-sm font-medium">¿Cómo querés recibirlos?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['RETIRO_OPTICA', 'ENVIO_DOMICILIO'] as Modalidad[]).map((m) => {
            const activo = modalidad === m;
            return (
              <label
                key={m}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors',
                  activo ? 'border-negro bg-gris-claro' : 'border-negro/15 hover:border-negro/40',
                )}
              >
                <input
                  type="radio"
                  name="modalidad"
                  value={m}
                  checked={activo}
                  onChange={() => setModalidad(m)}
                  className="mt-1 h-4 w-4 shrink-0 accent-negro"
                  data-testid={`modalidad-${m}`}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-medium">
                    {m === 'RETIRO_OPTICA' ? <IconPin size={18} /> : <IconTruck size={18} />}
                    {MODALIDAD_LABEL[m]}
                  </span>
                  <span className="mt-1 block text-sm text-gris-texto">
                    {m === 'RETIRO_OPTICA'
                      ? 'Gratis. Te los ajustan en el momento en la óptica socia más cercana.'
                      : envioGratis
                        ? 'Envío gratis para este pedido. Ajuste gratis en tu óptica cuando quieras.'
                        : `${costoEnvio > 0 ? formatARS(costoEnvio) : 'Gratis'} · ajuste gratis en tu óptica cuando quieras.`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">{retiro ? 'Tu dirección' : 'Dirección de entrega'}</p>
          <p className="text-sm text-gris-texto">
            {retiro
              ? 'La usamos para elegir la óptica socia más cercana a tu casa.'
              : 'Ahí llegan tus anteojos. También define la óptica socia que los arma.'}
          </p>
        </div>

        {guardadas.length > 0 && (
          <Field label="Usar una dirección guardada">
            {(p) => (
              <Select {...p} value={guardadaId} onChange={(e) => usarGuardada(e.target.value)}>
                <option value="">Otra dirección</option>
                {guardadas.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.etiqueta} · {g.direccion}, {g.localidad}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {places && !manual && (
          <div className="relative">
            <Field label="Buscá tu dirección" hint="Calle y número, localidad. Elegí una opción de la lista.">
              {(p) => (
                <Input
                  {...p}
                  value={query}
                  onChange={(e) => buscarSugerencias(e.target.value)}
                  autoComplete="off"
                  placeholder="Av. Rivadavia 5020, Caballito"
                  role="combobox"
                  aria-expanded={sugerencias.length > 0}
                  aria-autocomplete="list"
                />
              )}
            </Field>
            {buscandoDir && (
              <span className="absolute right-4 top-10">
                <Spinner />
              </span>
            )}
            {sugerencias.length > 0 && (
              <ul role="listbox" className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-negro/15 bg-blanco shadow-lg">
                {sugerencias.map((s) => (
                  <li key={s.placeId} role="option" aria-selected={false}>
                    <button type="button" onClick={() => elegirSugerencia(s)} className="block w-full px-4 py-3 text-left hover:bg-gris-claro">
                      <span className="block text-sm font-medium">{s.principal}</span>
                      <span className="block text-xs text-gris-texto">{s.secundario}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setManual(true)} className="mt-2 text-sm underline underline-offset-4">
              Cargar la dirección a mano
            </button>
          </div>
        )}

        {(manual || !places) && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Calle y número" required error={err.direccion} className="sm:col-span-2">
              {(p) => <Input {...p} autoComplete="street-address" value={dir.direccion} onChange={set('direccion')} data-testid="direccion-direccion" />}
            </Field>
            <Field label="Piso / depto / referencia" error={err.piso}>
              {(p) => <Input {...p} value={dir.piso} onChange={set('piso')} data-testid="direccion-piso" />}
            </Field>
            <Field label="Código postal" required error={err.codigoPostal} hint="Ej. 1424 o C1424ABC">
              {(p) => <Input {...p} autoComplete="postal-code" value={dir.codigoPostal} onChange={set('codigoPostal')} maxLength={8} data-testid="direccion-cp" />}
            </Field>
            <Field label="Localidad" required error={err.localidad}>
              {(p) => <Input {...p} autoComplete="address-level2" value={dir.localidad} onChange={set('localidad')} data-testid="direccion-localidad" />}
            </Field>
            <Field label="Provincia" required error={err.provincia}>
              {(p) => (
                <Select {...p} value={dir.provincia} onChange={set('provincia')} data-testid="direccion-provincia">
                  <option value="">Elegí…</option>
                  {PROVINCIAS.map((pr) => (
                    <option key={pr} value={pr}>
                      {pr}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {places && (
              <button
                type="button"
                onClick={() => {
                  setManual(false);
                  setQuery('');
                }}
                className="text-left text-sm underline underline-offset-4 sm:col-span-2"
              >
                Buscar con el autocompletado
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className={cn('rounded-2xl border p-4', optica ? 'border-vetro bg-vetro/15' : 'border-negro/10 bg-gris-claro')}
        aria-live="polite"
        data-testid="optica-elegida"
      >
        <p className="text-sm font-medium">{retiro ? 'Retirás y te ajustan en' : 'Tu óptica socia'}</p>
        {buscandoOptica ? (
          <p className="mt-1 flex items-center gap-2 text-sm text-gris-texto">
            <Spinner /> Buscando la óptica socia más cercana…
          </p>
        ) : optica ? (
          <div className="mt-1 text-sm">
            <p className="text-base font-semibold" data-testid="optica-nombre">
              {optica.nombre}
            </p>
            <p className="text-negro/80">
              {optica.direccion}, {optica.localidad}
              {optica.distanciaKm !== null && optica.criterio === 'coordenadas' && ` · a ${optica.distanciaKm.toFixed(1)} km`}
            </p>
            {optica.horarios && <p className="text-gris-texto">{optica.horarios}</p>}
            {optica.criterio === 'orden' && (
              <p className="mt-2 text-xs text-gris-texto">
                Todavía no tenemos una óptica socia en tu zona: te asignamos la más cercana y te contactamos para coordinar.
              </p>
            )}
          </div>
        ) : errorOptica ? (
          <p className="mt-1 text-sm text-carey">{errorOptica}</p>
        ) : (
          <p className="mt-1 text-sm text-gris-texto">Completá tu dirección y te mostramos la óptica que arma tu pedido.</p>
        )}
        {err.optica && !optica && !buscandoOptica && <p className="mt-1 text-sm text-carey">{err.optica}</p>}
      </div>

      <Button type="submit" size="md" className="w-full sm:w-auto" disabled={buscandoOptica} data-testid="checkout-siguiente">
        Continuar
      </Button>
    </form>
  );
}
