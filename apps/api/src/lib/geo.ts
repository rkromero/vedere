// Geografía: distancia, óptica socia más cercana y proxy a Google Places / Geocoding
// (la clave vive en el servidor; si falta, el checkout funciona con carga manual + CP).
import { prisma } from '@vedere/db';
import type { Optica } from '@vedere/db';
import type { Env } from '../env.js';
import { AppError } from './errors.js';

/** Distancia aproximada en km entre dos coordenadas (haversine). */
export function distanciaKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface OpticaAsignada extends Optica {
  distanciaKm: number | null;
  /** Cómo se eligió: por coordenadas, por código postal o la primera activa. */
  criterio: 'coordenadas' | 'codigo_postal' | 'orden';
}

/**
 * Óptica socia que atiende el pedido: la más cercana por coordenadas; si no hay, la de CP más
 * parecido (prefijo numérico); si tampoco, la primera por orden.
 */
export async function opticaMasCercana(input: {
  lat?: number | null;
  lng?: number | null;
  codigoPostal?: string | null;
}): Promise<OpticaAsignada | null> {
  const activas = await prisma.optica.findMany({ where: { activa: true }, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] });
  if (activas.length === 0) return null;

  if (typeof input.lat === 'number' && typeof input.lng === 'number') {
    const conCoords = activas.filter((o) => o.lat !== null && o.lng !== null);
    if (conCoords.length) {
      let mejor = conCoords[0]!;
      let mejorKm = distanciaKm(input.lat, input.lng, mejor.lat!, mejor.lng!);
      for (const o of conCoords.slice(1)) {
        const km = distanciaKm(input.lat, input.lng, o.lat!, o.lng!);
        if (km < mejorKm) {
          mejor = o;
          mejorKm = km;
        }
      }
      return { ...mejor, distanciaKm: Math.round(mejorKm * 10) / 10, criterio: 'coordenadas' };
    }
  }

  const cp = (input.codigoPostal ?? '').replace(/\D/g, '').slice(0, 4);
  if (cp.length === 4) {
    const n = Number(cp);
    let mejor: Optica | null = null;
    let mejorDist = Number.POSITIVE_INFINITY;
    for (const o of activas) {
      const oc = o.codigoPostal.replace(/\D/g, '').slice(0, 4);
      if (oc.length !== 4) continue;
      const d = Math.abs(Number(oc) - n);
      if (d < mejorDist) {
        mejor = o;
        mejorDist = d;
      }
    }
    if (mejor) return { ...mejor, distanciaKm: null, criterio: 'codigo_postal' };
  }

  return { ...activas[0]!, distanciaKm: null, criterio: 'orden' };
}

// ---------- Google Places / Geocoding ----------

export function placesHabilitado(env: Env): boolean {
  return !!env.GOOGLE_MAPS_API_KEY;
}

export interface Sugerencia {
  placeId: string;
  descripcion: string;
  principal: string;
  secundario: string;
}

/** Autocompletado de direcciones (Places API New) restringido a Argentina. */
export async function autocompletarDireccion(
  env: Env,
  input: { texto: string; sessionToken?: string },
): Promise<Sugerencia[]> {
  if (!env.GOOGLE_MAPS_API_KEY) return [];
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY },
    body: JSON.stringify({
      input: input.texto,
      includedRegionCodes: ['ar'],
      languageCode: 'es-AR',
      includedPrimaryTypes: ['street_address', 'route', 'premise', 'subpremise'],
      ...(input.sessionToken ? { sessionToken: input.sessionToken } : {}),
    }),
  });
  if (!res.ok) throw new AppError(502, 'PLACES_ERROR', 'No pudimos buscar la dirección');
  const data = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId: string;
        text?: { text: string };
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      };
    }>;
  };
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      placeId: p.placeId,
      descripcion: p.text?.text ?? '',
      principal: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secundario: p.structuredFormat?.secondaryText?.text ?? '',
    }));
}

export interface DireccionNormalizada {
  placeId: string | null;
  direccionCompleta: string;
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  lat: number;
  lng: number;
}

type Componente = { longText?: string; shortText?: string; types?: string[] };

function armarDireccion(input: {
  placeId: string | null;
  formatted: string;
  componentes: Componente[];
  lat: number;
  lng: number;
}): DireccionNormalizada {
  const get = (tipo: string) => input.componentes.find((c) => c.types?.includes(tipo));
  const localidad =
    get('locality')?.longText ??
    get('sublocality_level_1')?.longText ??
    get('administrative_area_level_2')?.longText ??
    '';
  return {
    placeId: input.placeId,
    direccionCompleta: input.formatted,
    calle: get('route')?.longText ?? '',
    numero: get('street_number')?.longText ?? '',
    localidad,
    provincia: get('administrative_area_level_1')?.longText ?? '',
    codigoPostal: (get('postal_code')?.longText ?? '').replace(/[^0-9A-Za-z]/g, '').replace(/^[A-Za-z]/, '').slice(0, 4),
    lat: input.lat,
    lng: input.lng,
  };
}

/** Detalle de un lugar (por placeId) o geocodificación de una dirección en texto. */
export async function geocodificar(
  env: Env,
  input: { placeId?: string; direccion?: string; sessionToken?: string },
): Promise<DireccionNormalizada | null> {
  if (!env.GOOGLE_MAPS_API_KEY) return null;
  if (input.placeId) {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(input.placeId)}`);
    url.searchParams.set('languageCode', 'es-AR');
    if (input.sessionToken) url.searchParams.set('sessionToken', input.sessionToken);
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'id,formattedAddress,addressComponents,location',
      },
    });
    if (!res.ok) throw new AppError(502, 'PLACES_ERROR', 'No pudimos obtener la dirección');
    const p = (await res.json()) as {
      id: string;
      formattedAddress?: string;
      addressComponents?: Componente[];
      location?: { latitude: number; longitude: number };
    };
    if (!p.location) return null;
    return armarDireccion({
      placeId: p.id,
      formatted: p.formattedAddress ?? '',
      componentes: p.addressComponents ?? [],
      lat: p.location.latitude,
      lng: p.location.longitude,
    });
  }
  if (input.direccion) {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', input.direccion);
    url.searchParams.set('region', 'ar');
    url.searchParams.set('language', 'es');
    url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);
    const res = await fetch(url);
    if (!res.ok) throw new AppError(502, 'GEOCODING_ERROR', 'No pudimos geocodificar la dirección');
    const data = (await res.json()) as {
      results?: Array<{
        place_id: string;
        formatted_address: string;
        address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };
    const r = data.results?.[0];
    if (!r) return null;
    return armarDireccion({
      placeId: r.place_id,
      formatted: r.formatted_address,
      componentes: r.address_components.map((c) => ({ longText: c.long_name, shortText: c.short_name, types: c.types })),
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
    });
  }
  return null;
}
