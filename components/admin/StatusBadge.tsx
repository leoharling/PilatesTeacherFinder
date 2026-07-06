import type { TeacherStatus, InquiryStatus } from '@/lib/types';

export const ADMIN_LABELS = {
  status: {
    pending: 'Neu',
    approved: 'Freigegeben',
    rejected: 'Abgelehnt',
  } as Record<TeacherStatus, string>,
  inquiryStatus: {
    new: 'Neu',
    contacted: 'Kontaktiert',
    placed: 'Vermittelt',
  } as Record<InquiryStatus, string>,
  genders: { female: 'Weiblich', male: 'Männlich', diverse: 'Divers' },
  styles: {
    classical: 'Klassisch',
    contemporary: 'Contemporary',
    rehab: 'Rehabilitativ / therapeutisch',
    athletic: 'Sportlich / athletic',
    prepostnatal: 'Pre-/Postnatal',
    seniors: 'Senioren',
    other: 'Sonstiges',
  },
  equipment: {
    mat: 'Matte',
    reformer: 'Reformer',
    cadillac: 'Cadillac / Trapeze Table',
    chair: 'Chair',
    ladder_barrel: 'Ladder Barrel',
    spine_corrector: 'Spine Corrector / Arc Barrel',
    springboard: 'Springboard',
    tower: 'Tower',
    small_props: 'Kleingeräte',
  },
  offerings: {
    personal_training: 'Personal Training',
    duet: 'Duett',
    small_groups: 'Kleingruppen',
    group_classes: 'Gruppenkurse',
    workshops: 'Workshops',
    teacher_training: 'Teacher Training',
    online: 'Online',
  },
  teachingLocations: {
    own_studio: 'Eigenes Studio',
    other_studio: 'Fremdstudio',
    gym: 'Fitnessstudio',
    physio_practice: 'Physiopraxis',
    clients_home: 'Beim Kunden zuhause',
    online: 'Online',
  },
  selfAssessments: {
    beginner: 'Einsteiger',
    advanced: 'Fortgeschritten',
    very_experienced: 'Sehr erfahren',
    expert: 'Experte',
  },
} as const;

export function labelList(
  keys: string[],
  map: Record<string, string>
): string {
  return keys.map((k) => map[k] ?? k).join(', ');
}

const statusStyles: Record<TeacherStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }: { status: TeacherStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
    >
      {ADMIN_LABELS.status[status]}
    </span>
  );
}

const inquiryStyles: Record<InquiryStatus, string> = {
  new: 'bg-amber-100 text-amber-800',
  contacted: 'bg-blue-100 text-blue-800',
  placed: 'bg-green-100 text-green-800',
};

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${inquiryStyles[status]}`}
    >
      {ADMIN_LABELS.inquiryStatus[status]}
    </span>
  );
}
