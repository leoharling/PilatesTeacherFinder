'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import type { TeacherPublicRow } from '@/lib/types';
import { filterTeachers, type TeacherFilters } from '@/lib/filter';
import { STYLES, EQUIPMENT, OFFERINGS } from '@/lib/options';
import TeacherCard from '@/components/TeacherCard';

const TeacherMap = dynamic(() => import('@/components/TeacherMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-blush-light" />,
});

const EMPTY: TeacherFilters = { styles: [], equipment: [], offerings: [], onlineOnly: false, query: '' };

type ChipKey = 'styles' | 'equipment' | 'offerings';

export default function MapExplorer({ teachers }: { teachers: TeacherPublicRow[] }) {
  const t = useTranslations('home');
  const tf = useTranslations('filters');
  const to = useTranslations('options');
  const [filters, setFilters] = useState<TeacherFilters>(EMPTY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => filterTeachers(teachers, filters), [teachers, filters]);
  const selected = filtered.find((x) => x.id === selectedId) ?? null;

  const activeCount =
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

  const chipGroup = (key: ChipKey, values: readonly string[], ns: string, label: string) => (
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

  const resultsList =
    filtered.length === 0 ? (
      <p className="text-sm text-charcoal-soft">{t('noResults')}</p>
    ) : (
      filtered.map((teacher) => <TeacherCard key={teacher.id} teacher={teacher} />)
    );

  return (
    <div className="flex flex-col lg:h-[calc(100vh-8rem)] lg:flex-row">
      <aside className="flex flex-col lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-blush-light">
        <div className="space-y-3 border-b border-blush-light p-4 lg:p-5">
          <input
            type="search"
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
            placeholder={tf('searchPlaceholder')}
            className="w-full rounded-xl border border-blush px-4 py-3 text-base focus:border-blush-deep focus:outline-none focus:ring-2 focus:ring-blush/60 lg:py-2.5 lg:text-sm"
          />

          {/* Mobile: collapsible filter toggle */}
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="flex min-h-10 items-center gap-2 rounded-full border border-blush px-4 text-sm font-medium text-charcoal transition-colors active:bg-blush-light"
              aria-expanded={showFilters}
            >
              {tf('title')}
              {activeCount > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-blush-deep text-[11px] text-white">
                  {activeCount}
                </span>
              )}
              <span aria-hidden>{showFilters ? '▾' : '▸'}</span>
            </button>
            <span className="text-sm text-charcoal-soft">
              {t('teachersFound', { count: filtered.length })}
            </span>
          </div>

          <div className={`${showFilters ? 'block' : 'hidden'} space-y-4 lg:block`}>
            {chipGroup('styles', STYLES, 'styles', tf('styles'))}
            {chipGroup('equipment', EQUIPMENT, 'equipment', tf('equipment'))}
            {chipGroup('offerings', OFFERINGS, 'offerings', tf('offerings'))}
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
                {t('teachersFound', { count: filtered.length })}
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

        {/* Desktop results list */}
        <div className="hidden space-y-3 p-5 lg:block">{resultsList}</div>
      </aside>

      <div className="relative order-none h-[52dvh] min-h-[320px] w-full lg:h-auto lg:flex-1">
        <TeacherMap teachers={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        {selected && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[1000] mx-auto max-w-md pb-safe">
            <div className="pointer-events-auto">
              <TeacherCard teacher={selected} onClose={() => setSelectedId(null)} />
            </div>
          </div>
        )}
      </div>

      {/* Mobile results list below the map */}
      <div className="space-y-3 p-4 pb-safe lg:hidden">{resultsList}</div>
    </div>
  );
}
