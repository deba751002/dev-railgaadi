import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { JourneyResponse } from '../services/trainService';

interface JourneyMapProps {
  route: JourneyResponse['route'];
  position: JourneyResponse['position'];
  distanceCoveredKm: number;
}

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;

export default function JourneyMap({ route, position, distanceCoveredKm }: JourneyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || route.length < 2) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAPTILER_KEY
        ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
        : {
            version: 8,
            sources: {},
            layers: [],
            glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
          },
      center: [route[0].lng, route[0].lat],
      zoom: 6,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    mapRef.current = map;

    map.on('load', () => {
      const completedCoords: [number, number][] = [];
      const remainingCoords: [number, number][] = [];
      for (const stop of route) {
        const coord: [number, number] = [stop.lng, stop.lat];
        if (stop.distanceKm <= distanceCoveredKm) completedCoords.push(coord);
        else remainingCoords.push(coord);
      }
      // Include the boundary point on both sides so the two lines connect visually.
      if (completedCoords.length && remainingCoords.length) {
        remainingCoords.unshift(completedCoords[completedCoords.length - 1]);
      }

      map.addSource('route-completed', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: completedCoords } },
      });
      map.addSource('route-remaining', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: remainingCoords } },
      });

      map.addLayer({
        id: 'route-remaining-line',
        type: 'line',
        source: 'route-remaining',
        paint: { 'line-color': '#3A3F4B', 'line-width': 3, 'line-dasharray': [2, 2] },
      });
      map.addLayer({
        id: 'route-completed-line',
        type: 'line',
        source: 'route-completed',
        paint: { 'line-color': '#0A84FF', 'line-width': 4 },
      });

      const bounds = route.reduce(
        (b, stop) => b.extend([stop.lng, stop.lat]),
        new maplibregl.LngLatBounds([route[0].lng, route[0].lat], [route[0].lng, route[0].lat]),
      );
      map.fitBounds(bounds, { padding: 48, duration: 0 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;

    if (!markerRef.current) {
      const el = document.createElement('div');
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.background = '#FFFFFF';
      el.style.border = '3px solid #0A84FF';
      el.style.boxShadow = '0 0 0 4px rgba(10,132,255,0.25)';
      markerRef.current = new maplibregl.Marker({ element: el }).setLngLat([position.lng, position.lat]).addTo(map);
    } else {
      markerRef.current.setLngLat([position.lng, position.lat]);
    }
  }, [position]);

  if (route.length < 2) {
    return (
      <div style={{ padding: 24, color: 'var(--text-secondary)' }}>
        Route map unavailable for this train (no coordinate data returned).
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height: 360, borderRadius: 14, overflow: 'hidden' }} />;
}
