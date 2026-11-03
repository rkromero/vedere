'use client';
// Mapa del backoffice: todas las ópticas con su radio de cobertura (Leaflet + OpenStreetMap/CARTO).
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { OpticaMapaItem } from '@/lib/types';

export function OpticasMapaAdmin({ opticas, seleccionada }: { opticas: OpticaMapaItem[]; seleccionada?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<Map<string, import('leaflet').Marker>>(new Map());

  useEffect(() => {
    let cancelado = false;
    const markers = markersRef.current;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelado || !ref.current || mapRef.current) return;
      const map = L.map(ref.current, { scrollWheelZoom: false });
      mapRef.current = map;
      // Teselas de OpenStreetMap (las de CARTO pasaron a exigir API key).
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const punto = (activa: boolean) =>
        L.divIcon({
          className: '',
          html: `<span style="display:flex;width:36px;height:36px;align-items:center;justify-content:center"><span style="display:block;width:16px;height:16px;border-radius:9999px;background:${activa ? '#0A0A0A' : '#9A9A95'};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span></span>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -12],
        });
      for (const o of opticas) {
        L.circle([o.lat, o.lng], {
          radius: o.radioKm * 1000,
          color: o.activa ? '#0A0A0A' : '#9A9A95',
          weight: 1,
          opacity: 0.5,
          fillColor: o.activa ? '#C9D7CF' : '#D9D9D6',
          fillOpacity: 0.18,
        }).addTo(map);
        const m = L.marker([o.lat, o.lng], { icon: punto(o.activa), title: o.nombre, alt: o.nombre })
          .addTo(map)
          .bindPopup(
            `<strong>${o.nombre}</strong>${o.activa ? '' : ' <em>(pausada)</em>'}<br>${o.direccion}, ${o.localidad}<br><span style="color:#5F5F5B">Radio ${o.radioKm} km · hasta ${o.capacidadDiaria} pedidos/día</span>`,
          );
        markers.set(o.id, m);
      }
      if (opticas.length > 0) {
        map.fitBounds(L.latLngBounds(opticas.map((o) => [o.lat, o.lng] as [number, number])), { padding: [24, 24], maxZoom: 12 });
      } else {
        map.setView([-34.6, -58.4], 11);
      }
    })();
    return () => {
      cancelado = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markers.clear();
    };
    // Sólo al montar: la página se recarga (router.refresh) al editar ópticas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!seleccionada) return;
    const m = markersRef.current.get(seleccionada);
    const map = mapRef.current;
    if (!m || !map) return;
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 13), { animate: true });
    m.openPopup();
  }, [seleccionada]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Mapa de ópticas socias con radio de cobertura"
      className="h-80 w-full overflow-hidden rounded-xl border border-negro/10 bg-gris-claro md:h-[26rem]"
    />
  );
}
