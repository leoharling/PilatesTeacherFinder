import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { TeacherRow } from '@/lib/types';
import { photoUrl } from '@/lib/types';
import { StatusBadge, ADMIN_LABELS, labelList } from '@/components/admin/StatusBadge';
import TeacherActions from '@/components/admin/TeacherActions';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-charcoal-soft">{label}</dt>
      <dd className="mt-0.5 text-sm whitespace-pre-line">{value || '—'}</dd>
    </div>
  );
}

export default async function AdminTeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!data) notFound();
  const t = data as TeacherRow;
  const src = photoUrl(t.photo_path);

  return (
    <div className="mx-auto max-w-4xl pb-safe">
      <Link
        href="/admin"
        className="inline-flex min-h-9 items-center text-sm text-charcoal-soft transition-colors active:text-charcoal sm:hover:text-charcoal"
      >
        ← Zurück zur Übersicht
      </Link>
      <div className="mt-3 rounded-2xl border border-blush-light bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            {src ? (
              <Image src={src} alt="" width={80} height={80} className="size-16 rounded-full object-cover sm:size-20" />
            ) : (
              <div className="size-16 rounded-full bg-blush-light sm:size-20" />
            )}
            <div>
              <h1 className="text-xl font-semibold">
                {t.first_name} {t.last_name}
              </h1>
              <p className="text-sm text-charcoal-soft">
                {t.postal_code} {t.city}, {t.country}
              </p>
              <div className="mt-1"><StatusBadge status={t.status} /></div>
            </div>
          </div>
          <TeacherActions id={t.id} status={t.status} />
        </div>

        <h2 className="heading-brand mt-8 mb-3 text-xs">Kontakt (nicht öffentlich)</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="E-Mail" value={<a href={`mailto:${t.email}`} className="text-blush-deep hover:underline">{t.email}</a>} />
          <Field label="Telefon" value={<a href={`tel:${t.phone}`} className="text-blush-deep hover:underline">{t.phone}</a>} />
          <Field label="Website / Instagram" value={t.website_instagram} />
          <Field label="Geschlecht" value={ADMIN_LABELS.genders[t.gender as keyof typeof ADMIN_LABELS.genders] ?? t.gender} />
          <Field label="Eingereicht am" value={new Date(t.created_at).toLocaleString('de-DE')} />
        </dl>

        <h2 className="heading-brand mt-8 mb-3 text-xs">Standort</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Hauptstandort" value={t.location_name} />
          <Field label="Umkreis" value={`${t.radius_km} km`} />
          <Field label="Max. Entfernung" value={`${t.max_distance_km} km`} />
          <Field label="Online-Unterricht" value={t.online_teaching ? 'Ja' : 'Nein'} />
          <Field
            label="Koordinaten"
            value={
              t.lat !== null
                ? `${t.lat.toFixed(4)}, ${t.lng?.toFixed(4)}`
                : '⚠ Standort nicht gefunden — Trainer erscheint nicht auf der Karte'
            }
          />
        </dl>

        <h2 className="heading-brand mt-8 mb-3 text-xs">Profil</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Pilates-Stile" value={labelList(t.styles, ADMIN_LABELS.styles)} />
          <Field label="Sonstiger Stil" value={t.styles_other} />
          <Field label="Geräte" value={labelList(t.equipment, ADMIN_LABELS.equipment)} />
          <Field label="Angebot" value={labelList(t.offerings, ADMIN_LABELS.offerings)} />
          <Field label="Unterrichtsorte" value={labelList(t.teaching_locations, ADMIN_LABELS.teachingLocations)} />
          <Field label="Selbsteinschätzung" value={ADMIN_LABELS.selfAssessments[t.self_assessment as keyof typeof ADMIN_LABELS.selfAssessments] ?? t.self_assessment} />
          <Field label="Unterrichtet seit" value={t.teaching_since} />
          <Field label="Jahre Erfahrung" value={t.experience_years} />
        </dl>
        <div className="mt-4 space-y-4">
          <Field label="Ausbildungen" value={t.educations} />
          <Field label="Zertifizierungen" value={t.certifications} />
          <Field label="Fortbildungen (letzte 2 Jahre)" value={t.recent_trainings} />
          <Field label="Besondere Qualität" value={t.quality_statement} />
        </div>

        {t.status === 'approved' && (
          <Link
            href={`/de/trainer/${t.id}`}
            className="mt-6 inline-flex min-h-10 items-center text-sm text-blush-deep transition-opacity active:opacity-70 sm:hover:underline"
          >
            Öffentliches Profil ansehen →
          </Link>
        )}
      </div>
    </div>
  );
}
