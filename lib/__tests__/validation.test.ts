import { describe, expect, it } from 'vitest';
import {
  teacherIntakeSchema,
  inquirySchema,
  parseIntakeFormData,
  flattenZodErrors,
} from '@/lib/validation';

const validIntake = {
  first_name: 'Anna',
  last_name: 'Kramer',
  gender: 'female',
  email: 'anna@example.com',
  phone: '+49 170 1234567',
  website_instagram: '@annapilates',
  location_name: 'Studio Mitte',
  postal_code: '10115',
  city: 'Berlin',
  country: 'Deutschland',
  radius_km: 25,
  online_teaching: true,
  styles: ['classical', 'contemporary'],
  styles_other: '',
  equipment: ['mat', 'reformer'],
  teaching_since: 2018,
  experience_years: 8,
  educations: 'Sandra Leo Pilates Education, 500h',
  certifications: '',
  recent_trainings: '',
  self_assessment: 'very_experienced',
  quality_statement: 'Volle Kurse seit Jahren.',
  offerings: ['group_classes', 'personal_training'],
  teaching_locations: ['other_studio'],
  max_distance_km: 30,
  confirmed: true,
};

describe('teacherIntakeSchema', () => {
  it('accepts a valid intake', () => {
    const result = teacherIntakeSchema.safeParse(validIntake);
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields and unchecked confirmation', () => {
    const result = teacherIntakeSchema.safeParse({
      ...validIntake,
      first_name: '',
      confirmed: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = flattenZodErrors(result.error);
      expect(errors.first_name).toBeDefined();
      expect(errors.confirmed).toBeDefined();
    }
  });

  it('rejects an empty string for a required numeric field instead of coercing to 0', () => {
    const result = teacherIntakeSchema.safeParse({
      ...validIntake,
      experience_years: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = flattenZodErrors(result.error);
      expect(errors.experience_years).toBeDefined();
    }
  });

  it('rejects invalid email and unknown style keys', () => {
    const result = teacherIntakeSchema.safeParse({
      ...validIntake,
      email: 'not-an-email',
      styles: ['jazzercise'],
    });
    expect(result.success).toBe(false);
  });

  it('requires at least one style, equipment, offering, location', () => {
    const result = teacherIntakeSchema.safeParse({
      ...validIntake,
      styles: [],
      equipment: [],
      offerings: [],
      teaching_locations: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = flattenZodErrors(result.error);
      expect(errors.styles).toBeDefined();
      expect(errors.equipment).toBeDefined();
      expect(errors.offerings).toBeDefined();
      expect(errors.teaching_locations).toBeDefined();
    }
  });
});

describe('parseIntakeFormData', () => {
  it('collects multi-select arrays, coerces booleans and numbers', () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(validIntake)) {
      if (Array.isArray(v)) v.forEach((item) => fd.append(k, item));
      else fd.set(k, String(v));
    }
    const parsed = parseIntakeFormData(fd);
    expect(parsed.styles).toEqual(['classical', 'contemporary']);
    expect(parsed.online_teaching).toBe(true);
    expect(parsed.confirmed).toBe(true);
    const result = teacherIntakeSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it('treats absent checkboxes as false and absent multi-selects as empty', () => {
    const fd = new FormData();
    fd.set('first_name', 'Anna');
    const parsed = parseIntakeFormData(fd);
    expect(parsed.online_teaching).toBe(false);
    expect(parsed.confirmed).toBe(false);
    expect(parsed.styles).toEqual([]);
  });
});

describe('inquirySchema', () => {
  it('accepts a valid inquiry', () => {
    const result = inquirySchema.safeParse({
      teacher_id: '3f1a3e1e-9d1e-4d0a-8c2b-1a2b3c4d5e6f',
      studio_name: 'Pilates Loft Köln',
      contact_name: 'Maria Beispiel',
      email: 'maria@loft.de',
      phone: '',
      location: 'Köln',
      message: 'Wir suchen ab September eine Trainerin für Reformer-Kurse.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing message/email', () => {
    const result = inquirySchema.safeParse({
      teacher_id: 'not-a-uuid',
      studio_name: '',
      contact_name: '',
      email: 'nope',
      message: '',
    });
    expect(result.success).toBe(false);
  });
});
