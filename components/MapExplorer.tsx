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

export default function MapExplorer({ teachers }: { teachers: TeacherPublicRow[] }) {
  const t = useTranslations('home');
  const tf = useTranslations('filters');
  const to = useTranslations('options');
  const [filters, setFilters] = useState<TeacherFilters>(EMPTY);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => filterTeachers(teachers, filters), [teachers, filters]);
  const selected = filtered.find((x) => x.id === selectedId) ?? null;

  function toggle(key: 'styles' | 'equipment' | 'offerings', value: string) {
    setFilters((f) => {
      const list = f[key].includes(value)
        ? f[key].filter((v) => v !== value)
        : [...f[key], value];
      return { ...f, [key]: list };
    });
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col lg:flex-row">
      <aside className="w-full shrink-0 space-y-5 overflow-y-auto border-b border-blush-light p-5 lg:w-80 lg:border-r lg:border-b-0">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          placeholder={tf('searchPlaceholder')}
          className="w-full rounded-md border border-blush px-3 py-2 text-sm focus:border-blush-deep focus:outline-none"
        />
        <div>
          <p className="heading-brand mb-2 text-xs">{tf('styles')}</p>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle('styles', s)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  filters.styles.includes(s)
                    ? 'border-blush-deep bg-blush text-charcoal'
                    : 'border-blush-light text-charcoal-soft hover:border-blush'
                }`}
              >
                {to(`styles.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="heading-brand mb-2 text-xs">{tf('equipment')}</p>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle('equipment', s)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  filters.equipment.includes(s)
                    ? 'border-blush-deep bg-blush text-charcoal'
                    : 'border-blush-light text-charcoal-soft hover:border-blush'
                }`}
              >
                {to(`equipment.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="heading-brand mb-2 text-xs">{tf('offerings')}</p>
          <div className="flex flex-wrap gap-1.5">
            {OFFERINGS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle('offerings', s)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  filters.offerings.includes(s)
                    ? 'border-blush-deep bg-blush text-charcoal'
                    : 'border-blush-light text-charcoal-soft hover:border-blush'
                }`}
              >
                {to(`offerings.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.onlineOnly}
            onChange={(e) => setFilters((f) => ({ ...f, onlineOnly: e.target.checked }))}
            className="accent-blush-deep"
          />
          {tf('onlineOnly')}
        </label>
        <div className="flex items-center justify-between">
          <p className="text-sm text-charcoal-soft">
            {t('teachersFound', { count: filtered.length })}
          </p>
          <button
            type="button"
            onClick={() => setFilters(EMPTY)}
            className="text-xs text-blush-deep hover:underline"
          >
            {tf('reset')}
          </button>
        </div>
        <div className="hidden space-y-3 lg:block">
          {filtered.length === 0 && (
            <p className="text-sm text-charcoal-soft">{t('noResults')}</p>
          )}
          {filtered.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} />
          ))}
        </div>
      </aside>
      <div className="relative min-h-[420px] flex-1">
        <TeacherMap teachers={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        {selected && (
          <div className="absolute right-4 bottom-4 left-4 z-[1000] mx-auto max-w-md">
            <TeacherCard teacher={selected} />
          </div>
        )}
      </div>
    </div>
  );
}
