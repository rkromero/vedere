'use client';
// Mapa de ópticas socias con Leaflet (sólo en esta página; se carga en el cliente).
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Optica } from '@/lib/tienda/types';

export function OpticasMapa({
  opticas,
  seleccionada,
  onSeleccionar,
}: {
  opticas: Optica[];
  seleccionada?: string | null;
  onSeleccionar?: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<Map<string, import('leaflet').Marker>>(new Map());

  useEffect(() => {
    let cancelado = false;
    const markers = markersRef.current;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelado || !ref.current || mapRef.current) return;
      const map = L.map(ref.current, { scrollWheelZoom: false, zoomControl: true });
      mapRef.current = map;
      // Teselas de OpenStreetMap (las de CARTO pasaron a exigir API key).
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const conCoords = opticas.filter((o) => o.lat !== null && o.lng !== null);
      const icon = L.divIcon({
        className: '',
        // Área táctil de 44 px con un punto de 18 px en el centro.
        html: '<span style="display:flex;width:44px;height:44px;align-items:center;justify-content:center"><span style="display:block;width:18px;height:18px;border-radius:9999px;background:#0A0A0A;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span></span>',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -14],
      });
      for (const o of conCoords) {
        const m = L.marker([o.lat!, o.lng!], { icon, title: o.nombre, alt: o.nombre })
          .addTo(map)
          .bindPopup(
            `<strong>${o.nombre}</strong><br>${o.direccion}, ${o.localidad}${o.horarios ? `<br><span style="color:#5F5F5B">${o.horarios}</span>` : ''}`,
          );
        m.on('click', () => onSeleccionar?.(o.id));
        markers.set(o.id, m);
      }
      if (conCoords.length > 0) {
        map.fitBounds(
          L.latLngBounds(conCoords.map((o) => [o.lat!, o.lng!] as [number, number])),
          { padding: [24, 24], maxZoom: 13 },
        );
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
    // Sólo al montar: la lista se filtra en el cliente, el mapa muestra todas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!seleccionada) return;
    const m = markersRef.current.get(seleccionada);
    const map = mapRef.current;
    if (!m || !map) return;
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 14), { animate: true });
    m.openPopup();
  }, [seleccionada]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Mapa de ópticas socias"
      className="h-72 w-full overflow-hidden rounded-2xl bg-gris-claro md:h-[28rem] lg:h-[36rem]"
    />
  );
}
