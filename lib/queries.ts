import { createSupabasePublicClient } from '@/lib/supabase/public';
import type { TeacherPublicRow } from '@/lib/types';

export async function getApprovedTeachers(): Promise<TeacherPublicRow[]> {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from('teachers_public')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('getApprovedTeachers failed', error);
    return [];
  }
  return (data ?? []) as TeacherPublicRow[];
}

export async function getTeacherById(
  id: string
): Promise<TeacherPublicRow | null> {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from('teachers_public')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('getTeacherById failed', error);
    return null;
  }
  return (data as TeacherPublicRow) ?? null;
}
