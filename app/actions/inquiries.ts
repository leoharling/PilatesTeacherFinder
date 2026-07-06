'use server';

import { inquirySchema, flattenZodErrors } from '@/lib/validation';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { sendInquiryNotification } from '@/lib/email';

export type InquiryResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

export async function submitInquiry(formData: FormData): Promise<InquiryResult> {
  const raw = {
    teacher_id: String(formData.get('teacher_id') ?? ''),
    studio_name: String(formData.get('studio_name') ?? ''),
    contact_name: String(formData.get('contact_name') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    location: String(formData.get('location') ?? ''),
    message: String(formData.get('message') ?? ''),
  };
  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: flattenZodErrors(parsed.error) };
  }

  const supabase = createSupabaseServiceClient();

  // Only accept inquiries for approved (publicly visible) teachers.
  const { data: teacher } = await supabase
    .from('teachers_public')
    .select('id, display_name')
    .eq('id', parsed.data.teacher_id)
    .maybeSingle();
  if (!teacher) {
    return { ok: false, errors: { _form: 'generic' } };
  }

  const { error } = await supabase.from('inquiries').insert(parsed.data);
  if (error) {
    console.error('inquiry insert failed', error);
    return { ok: false, errors: { _form: 'generic' } };
  }

  await sendInquiryNotification({
    teacherDisplayName: teacher.display_name,
    studioName: parsed.data.studio_name,
    contactName: parsed.data.contact_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    location: parsed.data.location,
    message: parsed.data.message,
  });

  return { ok: true };
}
