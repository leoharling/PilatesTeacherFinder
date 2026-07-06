export const GENDERS = ['female', 'male', 'diverse'] as const;

export const STYLES = [
  'classical',
  'contemporary',
  'rehab',
  'athletic',
  'prepostnatal',
  'seniors',
  'other',
] as const;

export const EQUIPMENT = [
  'mat',
  'reformer',
  'cadillac',
  'chair',
  'ladder_barrel',
  'spine_corrector',
  'springboard',
  'tower',
  'small_props',
] as const;

export const OFFERINGS = [
  'personal_training',
  'duet',
  'small_groups',
  'group_classes',
  'workshops',
  'teacher_training',
  'online',
] as const;

export const TEACHING_LOCATIONS = [
  'own_studio',
  'other_studio',
  'gym',
  'physio_practice',
  'clients_home',
  'online',
] as const;

export const SELF_ASSESSMENTS = [
  'beginner',
  'advanced',
  'very_experienced',
  'expert',
] as const;

export type Gender = (typeof GENDERS)[number];
export type Style = (typeof STYLES)[number];
export type Equipment = (typeof EQUIPMENT)[number];
export type Offering = (typeof OFFERINGS)[number];
export type TeachingLocation = (typeof TEACHING_LOCATIONS)[number];
export type SelfAssessment = (typeof SELF_ASSESSMENTS)[number];
