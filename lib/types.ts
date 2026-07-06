export type TeacherStatus = 'pending' | 'approved' | 'rejected';
export type InquiryStatus = 'new' | 'contacted' | 'placed';

// Matches columns of public.teachers_public exactly (see supabase migration).
export interface TeacherPublicRow {
  id: string;
  display_name: string;
  city: string;
  postal_code: string;
  country: string;
  radius_km: number;
  online_teaching: boolean;
  styles: string[];
  styles_other: string;
  equipment: string[];
  teaching_since: number | null;
  experience_years: number | null;
  educations: string;
  certifications: string;
  recent_trainings: string;
  self_assessment: string;
  quality_statement: string;
  offerings: string[];
  teaching_locations: string[];
  max_distance_km: number;
  photo_path: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

// Full row of public.teachers — admin only.
export interface TeacherRow extends Omit<TeacherPublicRow, 'display_name'> {
  updated_at: string;
  status: TeacherStatus;
  first_name: string;
  last_name: string;
  gender: string;
  email: string;
  phone: string;
  website_instagram: string;
  location_name: string;
}

export interface InquiryRow {
  id: string;
  created_at: string;
  teacher_id: string;
  studio_name: string;
  contact_name: string;
  email: string;
  phone: string;
  location: string;
  message: string;
  status: InquiryStatus;
}

export function photoUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/teacher-photos/${path}`;
}
