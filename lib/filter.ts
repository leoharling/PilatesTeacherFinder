import type { TeacherPublicRow } from '@/lib/types';

export interface TeacherFilters {
  styles: string[];
  equipment: string[];
  offerings: string[];
  onlineOnly: boolean;
  query: string;
}

export function filterTeachers(
  teachers: TeacherPublicRow[],
  f: TeacherFilters
): TeacherPublicRow[] {
  const q = f.query.trim().toLowerCase();
  return teachers.filter((t) => {
    if (f.styles.length > 0 && !f.styles.some((s) => t.styles.includes(s))) return false;
    if (f.equipment.length > 0 && !f.equipment.some((e) => t.equipment.includes(e))) return false;
    if (f.offerings.length > 0 && !f.offerings.some((o) => t.offerings.includes(o))) return false;
    if (f.onlineOnly && !t.online_teaching) return false;
    if (q && !t.city.toLowerCase().includes(q)) return false;
    return true;
  });
}
