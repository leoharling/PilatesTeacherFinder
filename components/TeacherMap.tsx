'use client';

import { useEffect, useRef, useState } from 'react';
import type { TeacherPublicRow, Studio } from '@/lib/types';
import 'leaflet/dist/leaflet.css';

const GERMANY_CENTER: [number, number] = [51.1657, 10.4515];

export type MapFocus = { lat: number; lng: number; studioId?: string; nonce: number };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

const TEACHER_STYLE = {
  radius: 9,
  color: '#ffffff',
  weight: 2,
  fillColor: '#e8a8c4',
  fillOpacity: 1,
};
const TEACHER_SELECTED = { ...TEACHER_STYLE, radius: 12, fillColor: '#d98bb0' };
const STUDIO_STYLE = {
  radius: 6,
  color: '#ffffff',
  weight: 1.5,
  fillColor: '#3a3a3a',
  fillOpacity: 0.9,
};

export default function TeacherMap({
  teachers,
  studios,
  selectedId,
  onSelect,
  sizeVersion = 0,
  focus,
}: {
  teachers: TeacherPublicRow[];
  studios: Studio[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  sizeVersion?: number;
  focus?: MapFocus | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const LRef = useRef<typeof import('leaflet') | null>(null);
  const teacherLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const studioLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const teacherCanvasRef = useRef<import('leaflet').Canvas | null>(null);
  const studioCanvasRef = useRef<import('leaflet').Canvas | null>(null);
  const teacherMarkers = useRef(new Map<string, import('leaflet').CircleMarker>());
  const studioMarkers = useRef(new Map<string, import('leaflet').CircleMarker>());
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  function flyTo(lat: number, lng: number) {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 12), { duration: 0.8 });
  }

  // Init once.
  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (disposed || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        preferCanvas: true,
        scrollWheelZoom: true,
        zoomSnap: 1,
        wheelPxPerZoomLevel: 120,
        wheelDebounceTime: 20,
        zoomAnimation: true,
        fadeAnimation: true,
        inertia: true,
      }).setView(GERMANY_CENTER, 6);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        keepBuffer: 3,
        updateWhenIdle: false,
      }).addTo(map);

      // Separate panes so studio dots always draw above teacher dots
      // (studios stay visible in cities that also have a teacher).
      map.createPane('teachersPane').style.zIndex = '440';
      map.createPane('studiosPane').style.zIndex = '450';
      teacherCanvasRef.current = L.canvas({ pane: 'teachersPane', padding: 0.5 });
      studioCanvasRef.current = L.canvas({ pane: 'studiosPane', padding: 0.5 });
      studioLayerRef.current = L.layerGroup().addTo(map);
      teacherLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      LRef.current = L;
      map.on('click', () => onSelectRef.current(null));
      setReady(true);
    })();

    return () => {
      disposed = true;
    };
  }, []);

  // Studios: subtle charcoal dots (canvas) with a contact popup.
  useEffect(() => {
    const L = LRef.current;
    const layer = studioLayerRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    studioMarkers.current.clear();
    for (const s of studios) {
      if (s.lat === null || s.lng === null) continue;
      const marker = L.circleMarker([s.lat, s.lng], {
        renderer: studioCanvasRef.current ?? undefined,
        ...STUDIO_STYLE,
      });
      const addr = s.address ? `<br>${escapeHtml(s.address)}` : `<br>${escapeHtml(s.city)}`;
      const phone = s.phone
        ? `<br><a href="tel:${escapeHtml(s.phone.replace(/[^+0-9]/g, ''))}" style="color:#c77ba0">${escapeHtml(s.phone)}</a>`
        : '';
      const email = s.email
        ? `<br><a href="mailto:${escapeHtml(s.email)}" style="color:#c77ba0">${escapeHtml(s.email)}</a>`
        : '';
      const site = s.website
        ? `<br><a href="${escapeHtml(s.website)}" target="_blank" rel="noopener noreferrer" style="color:#c77ba0">Website ↗</a>`
        : '';
      marker.bindPopup(`<strong>${escapeHtml(s.name)}</strong>${addr}${phone}${email}${site}`);
      const lat = s.lat;
      const lng = s.lng;
      marker.on('click', () => flyTo(lat, lng));
      marker.addTo(layer);
      studioMarkers.current.set(s.id, marker);
    }
  }, [studios, ready]);

  // Teachers: prominent pink dots (canvas) that open the profile card.
  useEffect(() => {
    const L = LRef.current;
    const layer = teacherLayerRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    teacherMarkers.current.clear();
    for (const t of teachers) {
      if (t.lat === null || t.lng === null) continue;
      const marker = L.circleMarker([t.lat, t.lng], {
        renderer: teacherCanvasRef.current ?? undefined,
        ...TEACHER_STYLE,
      });
      const id = t.id;
      const lat = t.lat;
      const lng = t.lng;
      marker.on('click', () => {
        onSelectRef.current(id);
        flyTo(lat, lng);
      });
      marker.addTo(layer);
      teacherMarkers.current.set(id, marker);
    }
  }, [teachers, ready]);

  // Highlight the selected teacher.
  useEffect(() => {
    if (!ready) return;
    for (const [id, marker] of teacherMarkers.current) {
      marker.setStyle(id === selectedId ? TEACHER_SELECTED : TEACHER_STYLE);
      if (id === selectedId) marker.bringToFront();
    }
  }, [selectedId, ready]);

  // Fly to an externally-focused point (list clicks); open studio popup.
  useEffect(() => {
    if (!ready || !focus) return;
    flyTo(focus.lat, focus.lng);
    if (focus.studioId) {
      studioMarkers.current.get(focus.studioId)?.openPopup();
    }
  }, [focus, ready]);

  // Re-fit when the container resizes (sidebar drag / layout change).
  useEffect(() => {
    if (!ready) return;
    mapRef.current?.invalidateSize({ animate: false });
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

  return <div ref={containerRef} className="h-full w-full" />;
}
