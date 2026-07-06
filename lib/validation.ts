import { z, type ZodError } from 'zod';
import {
  GENDERS,
  STYLES,
  EQUIPMENT,
  OFFERINGS,
  TEACHING_LOCATIONS,
  SELF_ASSESSMENTS,
} from '@/lib/options';

const CURRENT_YEAR = new Date().getFullYear();

// Required numeric fields must reject empty strings rather than silently
// coercing '' -> 0 (z.coerce.number() would otherwise turn an empty input
// into a valid 0).
const requiredInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(min).max(max)
  );

export const teacherIntakeSchema = z.object({
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  gender: z.enum(GENDERS),
  email: z.email(),
  phone: z.string().trim().min(5),
  website_instagram: z.string().trim().max(300).default(''),
  location_name: z.string().trim().min(1),
  postal_code: z.string().trim().min(3).max(10),
  city: z.string().trim().min(1),
  country: z.string().trim().min(1).default('Deutschland'),
  radius_km: requiredInt(0, 1000),
  online_teaching: z.boolean(),
  styles: z.array(z.enum(STYLES)).min(1),
  styles_other: z.string().trim().max(300).default(''),
  equipment: z.array(z.enum(EQUIPMENT)).min(1),
  teaching_since: requiredInt(1950, CURRENT_YEAR),
  experience_years: requiredInt(0, 80),
  educations: z.string().trim().min(1).max(2000),
  certifications: z.string().trim().max(2000).default(''),
  recent_trainings: z.string().trim().max(2000).default(''),
  self_assessment: z.enum(SELF_ASSESSMENTS),
  quality_statement: z.string().trim().min(1).max(2000),
  offerings: z.array(z.enum(OFFERINGS)).min(1),
  teaching_locations: z.array(z.enum(TEACHING_LOCATIONS)).min(1),
  max_distance_km: requiredInt(0, 1000),
  confirmed: z.literal(true),
});

export type TeacherIntake = z.infer<typeof teacherIntakeSchema>;

export const inquirySchema = z.object({
  teacher_id: z.uuid(),
  studio_name: z.string().trim().min(1).max(200),
  contact_name: z.string().trim().min(1).max(200),
  email: z.email(),
  phone: z.string().trim().max(50).default(''),
  location: z.string().trim().max(200).default(''),
  message: z.string().trim().min(1).max(5000),
});

export type Inquiry = z.infer<typeof inquirySchema>;

const MULTI_FIELDS = ['styles', 'equipment', 'offerings', 'teaching_locations'] as const;
const BOOL_FIELDS = ['online_teaching', 'confirmed'] as const;

export function parseIntakeFormData(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of teacherIntakeSchema.keyof().options) {
    if ((MULTI_FIELDS as readonly string[]).includes(key)) {
      out[key] = fd.getAll(key).map(String);
    } else if ((BOOL_FIELDS as readonly string[]).includes(key)) {
      const v = fd.get(key);
      out[key] = v === 'true' || v === 'on';
    } else {
      const v = fd.get(key);
      out[key] = v === null ? undefined : String(v);
    }
  }
  return out;
}

export function flattenZodErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
