import { describe, expect, it } from 'vitest';
import { filterTeachers, type TeacherFilters } from '@/lib/filter';
import type { TeacherPublicRow } from '@/lib/types';

function teacher(partial: Partial<TeacherPublicRow>): TeacherPublicRow {
  return {
    id: 'x',
    display_name: 'Anna K.',
    city: 'Berlin',
    postal_code: '10115',
    country: 'Deutschland',
    radius_km: 25,
    online_teaching: false,
    styles: ['classical'],
    styles_other: '',
    equipment: ['mat'],
    teaching_since: 2018,
    experience_years: 8,
    educations: '',
    certifications: '',
    recent_trainings: '',
    self_assessment: 'advanced',
    quality_statement: '',
    offerings: ['group_classes'],
    teaching_locations: ['other_studio'],
    max_distance_km: 30,
    photo_path: null,
    lat: 52.5,
    lng: 13.4,
    created_at: '2026-07-06T00:00:00Z',
    ...partial,
  };
}

const none: TeacherFilters = { styles: [], equipment: [], offerings: [], onlineOnly: false, query: '' };

describe('filterTeachers', () => {
  const teachers = [
    teacher({ id: 'a', city: 'Berlin', styles: ['classical'], equipment: ['mat'] }),
    teacher({ id: 'b', city: 'München', postal_code: '80331', styles: ['contemporary'], equipment: ['reformer'], online_teaching: true }),
  ];

  it('returns all with empty filters', () => {
    expect(filterTeachers(teachers, none)).toHaveLength(2);
  });

  it('filters by style (any match)', () => {
    expect(filterTeachers(teachers, { ...none, styles: ['contemporary'] }).map((t) => t.id)).toEqual(['b']);
  });

  it('filters by equipment (any match)', () => {
    expect(filterTeachers(teachers, { ...none, equipment: ['mat'] }).map((t) => t.id)).toEqual(['a']);
  });

  it('filters by offering (any match)', () => {
    const withOfferings = [
      teacher({ id: 'a', offerings: ['group_classes'] }),
      teacher({ id: 'b', offerings: ['personal_training'] }),
    ];
    expect(filterTeachers(withOfferings, { ...none, offerings: ['personal_training'] }).map((t) => t.id)).toEqual(['b']);
  });

  it('filters online-only', () => {
    expect(filterTeachers(teachers, { ...none, onlineOnly: true }).map((t) => t.id)).toEqual(['b']);
  });

  it('matches query against city and postal code, case-insensitive', () => {
    expect(filterTeachers(teachers, { ...none, query: 'münch' }).map((t) => t.id)).toEqual(['b']);
    expect(filterTeachers(teachers, { ...none, query: '10115' }).map((t) => t.id)).toEqual(['a']);
  });
});
