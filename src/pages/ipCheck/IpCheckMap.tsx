import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { IpCheckTranslations } from '../../../shared/ipCheck';

interface IpCheckMapProps {
  latitude: number;
  longitude: number;
  city: string;
  translations: IpCheckTranslations;
}

export function IpCheckMap({
  latitude,
  longitude,
  city,
  translations,
}: IpCheckMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    const initialize = () => {
      setLoading(true);
      setError(false);
      try {
        if (!active || !containerRef.current) return;

        mapRef.current?.remove();
        const map = L.map(containerRef.current, {
          attributionControl: true,
          zoomControl: true,
        }).setView([latitude, longitude], 10);
        mapRef.current = map;

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20,
        }).addTo(map);

        const popup = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = city || translations.unknown;
        const coordinates = document.createElement('div');
        coordinates.textContent = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        popup.append(title, coordinates);

        const marker = L.divIcon({
          className: 'gaterank-ip-marker',
          html: '<span class="gaterank-ip-marker-pulse"></span><span class="gaterank-ip-marker-core"></span>',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
        L.marker([latitude, longitude], { icon: marker }).addTo(map).bindPopup(popup).openPopup();
        window.setTimeout(() => map.invalidateSize(), 0);
        if (active) setLoading(false);
      } catch {
        if (active) {
          setLoading(false);
          setError(true);
        }
      }
    };

    initialize();
    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [city, latitude, longitude, translations.unknown]);

  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-xl bg-slate-950/50 md:min-h-[440px]">
      <div
        ref={containerRef}
        className="absolute inset-0"
        aria-label={`${city || translations.unknown} ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
      />
      {loading ? (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-slate-950/70 text-sm font-bold text-slate-300">
          {translations.loadingMap}
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 z-[510] flex items-center justify-center bg-slate-950/90 px-6 text-center text-sm leading-6 text-slate-300">
          {translations.mapUnavailable}
        </div>
      ) : null}
    </div>
  );
}
