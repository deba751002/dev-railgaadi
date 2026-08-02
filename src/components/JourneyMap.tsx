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

// MapLibre ships its tile-processing logic as a separate worker file
// (node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs) that it expects to
// find next to wherever the library itself is served from. Vite bundles
// everything into one file instead, so without this the worker request 404s
// and — because of our SPA fallback redirect — silently gets index.html back
// (wrong MIME type), leaving the map stuck on a blank background color with
// no tiles/route ever rendering. We copy that file into public/ (see
// public/maplibre-gl-worker.mjs) and point MapLibre at it explicitly here.
maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');

function formatTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

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
            layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0B0E14' } }],
          },
      center: [route[0].lng, route[0].lat],
      zoom: 6,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
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
      if (completedCoords.length && remainingCoords.length) {
        remainingCoords.unshift(completedCoords[completedCoords.length - 1]);
      }

      map.addSource('route-completed', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: completedCoords },
        },
      });
      map.addSource('route-remaining', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: remainingCoords },
        },
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

      // Station points: every stop gets a dot + name label; halt stops (where
      // the train actually stops, not just passes through) get a bigger dot.
      map.addSource('stations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: route.map((stop) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [stop.lng, stop.lat] },
            properties: {
              stationName: stop.stationName,
              isHalt: stop.isHalt,
              arrivalTime: formatTime(stop.arrivalTime),
              departureTime: formatTime(stop.departureTime),
              haltMinutes: stop.haltMinutes,
            },
          })),
        },
      });
      map.addLayer({
        id: 'station-dots',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': ['case', ['get', 'isHalt'], 5, 3],
          'circle-color': ['case', ['get', 'isHalt'], '#0A84FF', '#8E8E93'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FFFFFF',
        },
      });
      map.addLayer({
        id: 'station-labels',
        type: 'symbol',
        source: 'stations',
        layout: {
          'text-field': ['get', 'stationName'],
          'text-size': 11,
          'text-anchor': 'top',
          'text-offset': [0, 0.8],
          'text-optional': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': '#0B0E14',
          'text-halo-width': 1.2,
        },
      });

      const popup = new maplibregl.Popup({ closeButton: false, offset: 12 });
      map.on('mouseenter', 'station-dots', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as any;
        const halt =
          p.haltMinutes && p.isHalt
            ? `Halts ${p.haltMinutes} min (${p.arrivalTime}–${p.departureTime})`
            : p.arrivalTime
              ? `Passes ~${p.arrivalTime}`
              : 'Halt time not available';
        popup
          .setLngLat((f.geometry as any).coordinates)
          .setHTML(`<strong>${p.stationName}</strong><br/>${halt}`)
          .addTo(map);
      });
      map.on('mouseleave', 'station-dots', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
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
      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([position.lng, position.lat])
        .addTo(map);
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

  return (
    <div ref={containerRef} style={{ width: '100%', height: 360, borderRadius: 14, overflow: 'hidden' }} />
  );
}
