'use client';

import { useEffect, useRef, useState } from 'react';
import type { TeacherPublicRow, Studio } from '@/lib/types';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const GERMANY_CENTER: [number, number] = [51.1657, 10.4515];

const teacherPinHtml =
  '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#e8a8c4;border:2px solid #ffffff;box-shadow:0 1px 5px rgba(0,0,0,.35)"></div>';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

export default function TeacherMap({
  teachers,
  studios,
  selectedId,
  onSelect,
  sizeVersion = 0,
}: {
  teachers: TeacherPublicRow[];
  studios: Studio[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  sizeVersion?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const LRef = useRef<typeof import('leaflet') | null>(null);
  const teacherLayerRef = useRef<ReturnType<
    typeof import('leaflet').markerClusterGroup
  > | null>(null);
  const studioLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const canvasRef = useRef<import('leaflet').Canvas | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Init the map once.
  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet.markercluster');
      if (disposed || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        // Smooth, low-jitter pan & zoom.
        preferCanvas: true,
        scrollWheelZoom: true,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 140,
        wheelDebounceTime: 30,
        zoomAnimation: true,
        markerZoomAnimation: true,
        fadeAnimation: true,
        inertia: true,
        worldCopyJump: false,
      }).setView(GERMANY_CENTER, 6);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      canvasRef.current = L.canvas({ padding: 0.5 });
      const studioLayer = L.layerGroup().addTo(map);
      const teacherLayer = L.markerClusterGroup({
        chunkedLoading: true,
        showCoverageOnHover: false,
        maxClusterRadius: 45,
      }).addTo(map);

      studioLayerRef.current = studioLayer;
      teacherLayerRef.current = teacherLayer;
      mapRef.current = map;
      LRef.current = L;
      map.on('click', () => onSelectRef.current(null));
      setReady(true);
    })();

    return () => {
      disposed = true;
    };
  }, []);

  // Render studios (canvas circle markers — subtle grey dots, no clustering).
  useEffect(() => {
    const L = LRef.current;
    const layer = studioLayerRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    for (const s of studios) {
      if (s.lat === null || s.lng === null) continue;
      const marker = L.circleMarker([s.lat, s.lng], {
        renderer: canvasRef.current ?? undefined,
        radius: 5,
        color: '#5b6169',
        weight: 1,
        fillColor: '#aeb4bb',
        fillOpacity: 0.75,
      });
      const address = s.address
        ? `<br>${escapeHtml(s.address)}`
        : `<br>${escapeHtml(s.city)}`;
      const phone = s.phone
        ? `<br><a href="tel:${escapeHtml(s.phone.replace(/[^+0-9]/g, ''))}" style="color:#e8a8c4">${escapeHtml(s.phone)}</a>`
        : '';
      const email = s.email
        ? `<br><a href="mailto:${escapeHtml(s.email)}" style="color:#e8a8c4">${escapeHtml(s.email)}</a>`
        : '';
      const site = s.website
        ? `<br><a href="${escapeHtml(s.website)}" target="_blank" rel="noopener noreferrer" style="color:#e8a8c4">Website</a>`
        : '';
      marker.bindPopup(
        `<strong>${escapeHtml(s.name)}</strong>${address}${phone}${email}${site}`
      );
      marker.addTo(layer);
    }
  }, [studios, ready]);

  // Render teacher pins (clustered).
  useEffect(() => {
    const L = LRef.current;
    const cluster = teacherLayerRef.current;
    if (!ready || !L || !cluster) return;
    cluster.clearLayers();
    const icon = L.divIcon({
      className: '',
      html: teacherPinHtml,
      iconSize: [26, 26],
      iconAnchor: [13, 26],
    });
    for (const t of teachers) {
      if (t.lat === null || t.lng === null) continue;
      const marker = L.marker([t.lat, t.lng], { icon, title: t.display_name });
      marker.on('click', () => onSelectRef.current(t.id));
      cluster.addLayer(marker);
    }
  }, [teachers, ready]);

  // Recompute size when the container is resized (sidebar drag, layout change).
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (map) map.invalidateSize({ animate: false });
  }, [sizeVersion, ready]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      teacherLayerRef.current = null;
      studioLayerRef.current = null;
      LRef.current = null;
    };
  }, []);

  void selectedId;

  return <div ref={containerRef} className="h-full w-full" />;
}
