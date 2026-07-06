'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { TeacherStatus, InquiryStatus } from '@/lib/types';

async function requireAdminClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  return supabase;
}

function revalidatePublic() {
  revalidatePath('/', 'layout'); // covers /de, /en, profiles
  revalidatePath('/admin');
}

export async function updateTeacherStatus(
  id: string,
  status: TeacherStatus
): Promise<void> {
  const supabase = await requireAdminClient();
  const { error } = await supabase
    .from('teachers')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(`Status-Update fehlgeschlagen: ${error.message}`);
  revalidatePublic();
}

export async function deleteTeacher(id: string): Promise<void> {
  const supabase = await requireAdminClient();
  const { error } = await supabase.from('teachers').delete().eq('id', id);
  if (error) throw new Error(`Löschen fehlgeschlagen: ${error.message}`);
  revalidatePublic();
  redirect('/admin');
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus
): Promise<void> {
  const supabase = await requireAdminClient();
  const { error } = await supabase
    .from('inquiries')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(`Status-Update fehlgeschlagen: ${error.message}`);
  revalidatePath('/admin/anfragen');
}
