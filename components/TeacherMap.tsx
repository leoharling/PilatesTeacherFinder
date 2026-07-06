'use client';

import { useEffect, useRef } from 'react';
import type { TeacherPublicRow } from '@/lib/types';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const GERMANY_CENTER: [number, number] = [51.1657, 10.4515];

export default function TeacherMap({
  teachers,
  selectedId,
  onSelect,
}: {
  teachers: TeacherPublicRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Leaflet types via any-free dynamic import; L is loaded once on mount.
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const clusterRef = useRef<ReturnType<typeof import('leaflet').markerClusterGroup> | null>(
    null
  );
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet.markercluster');
      if (disposed || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(
        GERMANY_CENTER,
        6
      );
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      mapRef.current = map;
      clusterRef.current = L.markerClusterGroup();
      map.addLayer(clusterRef.current);
      map.on('click', () => onSelectRef.current(null));
      renderMarkers(L);
    })();

    function renderMarkers(L: typeof import('leaflet')) {
      const cluster = clusterRef.current;
      if (!cluster) return;
      cluster.clearLayers();
      for (const t of teachers) {
        if (t.lat === null || t.lng === null) continue;
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#e8a8c4;border:2px solid #3a3a3a22;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });
        const marker = L.marker([t.lat, t.lng], { icon, title: t.display_name });
        marker.on('click', () => onSelectRef.current(t.id));
        cluster.addLayer(marker);
      }
    }

    // Re-render markers when teachers change and map already exists.
    if (mapRef.current) {
      import('leaflet').then((mod) => renderMarkers(mod.default));
    }

    return () => {
      disposed = true;
    };
  }, [teachers]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  // selectedId is accepted for future use (e.g. highlighting); markers drive selection.
  void selectedId;

  return <div ref={containerRef} className="h-full w-full" />;
}
