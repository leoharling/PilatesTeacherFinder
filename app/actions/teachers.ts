'use server';

import { randomUUID } from 'node:crypto';
import {
  teacherIntakeSchema,
  parseIntakeFormData,
  flattenZodErrors,
} from '@/lib/validation';
import { geocode } from '@/lib/geocode';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export type IntakeResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function submitTeacherApplication(
  formData: FormData
): Promise<IntakeResult> {
  const parsed = teacherIntakeSchema.safeParse(parseIntakeFormData(formData));
  if (!parsed.success) {
    return { ok: false, errors: flattenZodErrors(parsed.error) };
  }

  const photo = formData.get('photo');
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, errors: { photo: 'photoRequired' } };
  }
  if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) {
    return { ok: false, errors: { photo: 'photoType' } };
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return { ok: false, errors: { photo: 'photoTooLarge' } };
  }

  const supabase = createSupabaseServiceClient();

  const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
  const photoPath = `${randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('teacher-photos')
    .upload(photoPath, photo, { contentType: photo.type });
  if (uploadError) {
    console.error('photo upload failed', uploadError);
    return { ok: false, errors: { _form: 'generic' } };
  }

  const { confirmed: _confirmed, ...teacher } = parsed.data;
  const coords = await geocode(teacher.postal_code, teacher.city, teacher.country);

  const { error: insertError } = await supabase.from('teachers').insert({
    ...teacher,
    photo_path: photoPath,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    status: 'pending',
  });
  if (insertError) {
    console.error('teacher insert failed', insertError);
    return { ok: false, errors: { _form: 'generic' } };
  }

  return { ok: true };
}
