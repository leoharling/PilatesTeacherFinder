'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { TeacherPublicRow, Studio } from '@/lib/types';
import { filterTeachers, type TeacherFilters } from '@/lib/filter';
import { STYLES, EQUIPMENT, OFFERINGS } from '@/lib/options';
import TeacherCard from '@/components/TeacherCard';

const TeacherMap = dynamic(() => import('@/components/TeacherMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-blush-light" />,
});

const EMPTY: TeacherFilters = { styles: [], equipment: [], offerings: [], onlineOnly: false, query: '' };
type ChipKey = 'styles' | 'equipment' | 'offerings';
type Tab = 'teachers' | 'studios';

const MIN_W = 300;
const MAX_W = 640;
const DEFAULT_W = 384;

export default function MapExplorer({
  teachers,
  studios,
}: {
  teachers: TeacherPublicRow[];
  studios: Studio[];
}) {
  const t = useTranslations('home');
  const tf = useTranslations('filters');
  const to = useTranslations('options');

  const [tab, setTab] = useState<Tab>('teachers');
  const [filters, setFilters] = useState<TeacherFilters>(EMPTY);
  const [studioQuery, setStudioQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [width, setWidth] = useState(DEFAULT_W);
  const widthRef = useRef(DEFAULT_W);
  const [sizeVersion, setSizeVersion] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem('ptf.sidebarWidth'));
    if (saved >= MIN_W && saved <= MAX_W) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage
      setWidth(saved);
      widthRef.current = saved;
    }
  }, []);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  // While dragging, listen on the window so the pointer can leave the handle.
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const st = dragState.current;
      if (!st) return;
      const next = Math.min(MAX_W, Math.max(MIN_W, st.startW + (e.clientX - st.startX)));
      setWidth(next);
      setSizeVersion((v) => v + 1);
    };
    const up = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    const prevSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.userSelect = prevSelect;
      document.body.style.cursor = prevCursor;
      window.localStorage.setItem('ptf.sidebarWidth', String(widthRef.current));
    };
  }, [dragging]);

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startW: width };
    setDragging(true);
  }

  const filteredTeachers = useMemo(
    () => filterTeachers(teachers, filters),
    [teachers, filters]
  );
  const selected = filteredTeachers.find((x) => x.id === selectedId) ?? null;

  const filteredStudios = useMemo(() => {
    const q = studioQuery.trim().toLowerCase();
    if (!q) return studios;
    return studios.filter((s) => s.city.toLowerCase().includes(q));
  }, [studios, studioQuery]);

  const activeFilterCount =
    filters.styles.length +
    filters.equipment.length +
    filters.offerings.length +
    (filters.onlineOnly ? 1 : 0);

  function toggle(key: ChipKey, value: string) {
    setFilters((f) => {
      const list = f[key].includes(value)
        ? f[key].filter((v) => v !== value)
        : [...f[key], value];
      return { ...f, [key]: list };
    });
  }

  const chipGroup = (key: ChipKey, values: readonly string[], label: string, ns: string) => (
    <div>
      <p className="heading-brand mb-2 text-xs">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(key, s)}
            className={`flex min-h-9 items-center rounded-full border px-3 text-xs transition-colors ${
              filters[key].includes(s)
                ? 'border-blush-deep bg-blush text-charcoal'
                : 'border-blush-light text-charcoal-soft active:bg-blush-light sm:hover:border-blush'
            }`}
          >
            {to(`${ns}.${s}`)}
          </button>
        ))}
      </div>
    </div>
  );

  const teacherList =
    filteredTeachers.length === 0 ? (
      <p className="text-sm text-charcoal-soft">{t('noResults')}</p>
    ) : (
      filteredTeachers.map((teacher) => <TeacherCard key={teacher.id} teacher={teacher} />)
    );

  const studioList =
    filteredStudios.length === 0 ? (
      <p className="text-sm text-charcoal-soft">{t('studiosNone')}</p>
    ) : (
      filteredStudios.map((s) => (
        <div key={s.id} className="rounded-2xl border border-blush-light bg-white p-4">
          <p className="font-medium">{s.name}</p>
          <p className="text-sm text-charcoal-soft">{s.address || s.city}</p>
          {s.phone && (
            <a
              href={`tel:${s.phone.replace(/[^+0-9]/g, '')}`}
              className="mt-0.5 block text-sm text-charcoal-soft active:opacity-70"
            >
              {s.phone}
            </a>
          )}
          {s.website && (
            <a
              href={s.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex min-h-9 items-center text-sm text-blush-deep active:opacity-70 sm:hover:underline"
            >
              {t('studioWebsite')} ↗
            </a>
          )}
        </div>
      ))
    );

  const controls =
    tab === 'teachers' ? (
      <div className="space-y-3">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          placeholder={tf('searchPlaceholder')}
          className="w-full rounded-xl border border-blush px-4 py-3 text-base focus:border-blush-deep focus:outline-none focus:ring-2 focus:ring-blush/60 lg:py-2.5 lg:text-sm"
        />
        <div className="flex items-center justify-between gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="flex min-h-10 items-center gap-2 rounded-full border border-blush px-4 text-sm font-medium text-charcoal transition-colors active:bg-blush-light"
            aria-expanded={showFilters}
          >
            {tf('title')}
            {activeFilterCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-blush-deep text-[11px] text-white">
                {activeFilterCount}
              </span>
            )}
            <span aria-hidden>{showFilters ? '▾' : '▸'}</span>
          </button>
          <span className="text-sm text-charcoal-soft">
            {t('teachersFound', { count: filteredTeachers.length })}
          </span>
        </div>
        <div className={`${showFilters ? 'block' : 'hidden'} space-y-4 lg:block`}>
          {chipGroup('styles', STYLES, tf('styles'), 'styles')}
          {chipGroup('equipment', EQUIPMENT, tf('equipment'), 'equipment')}
          {chipGroup('offerings', OFFERINGS, tf('offerings'), 'offerings')}
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={filters.onlineOnly}
              onChange={(e) => setFilters((f) => ({ ...f, onlineOnly: e.target.checked }))}
              className="size-5 accent-blush-deep"
            />
            {tf('onlineOnly')}
          </label>
          <div className="flex items-center justify-between">
            <p className="hidden text-sm text-charcoal-soft lg:block">
              {t('teachersFound', { count: filteredTeachers.length })}
            </p>
            <button
              type="button"
              onClick={() => setFilters(EMPTY)}
              className="min-h-9 text-sm text-blush-deep active:opacity-70 sm:hover:underline"
            >
              {tf('reset')}
            </button>
          </div>
        </div>
      </div>
    ) : (
      <input
        type="search"
        value={studioQuery}
        onChange={(e) => setStudioQuery(e.target.value)}
        placeholder={tf('searchPlaceholder')}
        className="w-full rounded-xl border border-blush px-4 py-3 text-base focus:border-blush-deep focus:outline-none focus:ring-2 focus:ring-blush/60 lg:py-2.5 lg:text-sm"
      />
    );

  return (
    <div className="flex flex-col lg:h-[calc(100vh-9rem)] lg:flex-row">
      <aside
        style={{ width }}
        className="flex flex-col max-lg:w-full! lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-blush-light"
      >
        <div className="space-y-4 border-b border-blush-light p-4 lg:p-5">
          {/* Tabs */}
          <div className="flex rounded-full bg-blush-light/70 p-1 text-sm">
            <button
              type="button"
              onClick={() => setTab('teachers')}
              className={`flex-1 rounded-full py-2 font-medium transition-colors ${
                tab === 'teachers' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal-soft'
              }`}
            >
              {t('tabTeachers')} ({teachers.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('studios')}
              className={`flex-1 rounded-full py-2 font-medium transition-colors ${
                tab === 'studios' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal-soft'
              }`}
            >
              {t('tabStudios')} ({studios.length})
            </button>
          </div>

          {/* Pitch: many studios, few teachers */}
          <div className="rounded-xl bg-blush-light/60 p-3">
            <p className="heading-brand text-[11px] text-charcoal-soft">{t('pitchTitle')}</p>
            <p className="mt-1 text-sm leading-snug">
              {t('pitch', { studios: studios.length, teachers: teachers.length })}
            </p>
            <Link
              href="/registrieren"
              className="mt-2 inline-flex min-h-9 items-center text-sm font-medium text-blush-deep active:opacity-70 sm:hover:underline"
            >
              {t('becomeTeacher')} →
            </Link>
          </div>

          {controls}
        </div>

        {/* Desktop list */}
        <div className="hidden space-y-3 p-5 lg:block">
          {tab === 'teachers' ? teacherList : studioList}
        </div>
      </aside>

      {/* Resize handle (desktop only) */}
      <div
        onPointerDown={startDrag}
        role="separator"
        aria-orientation="vertical"
        className="hidden w-1.5 shrink-0 cursor-col-resize bg-blush-light transition-colors hover:bg-blush lg:block"
        title="Seitenleiste anpassen"
      />

      <div className="relative h-[58vh] min-h-[360px] w-full lg:h-auto lg:flex-1">
        <TeacherMap
          teachers={filteredTeachers}
          studios={studios}
          selectedId={selectedId}
          onSelect={setSelectedId}
          sizeVersion={sizeVersion}
        />
        {selected && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[1000] mx-auto max-w-md pb-safe">
            <div className="pointer-events-auto">
              <TeacherCard teacher={selected} onClose={() => setSelectedId(null)} />
            </div>
          </div>
        )}
      </div>

      {/* Mobile list below the map */}
      <div className="space-y-3 p-4 pb-safe lg:hidden">
        {tab === 'teachers' ? teacherList : studioList}
      </div>
    </div>
  );
}
