import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getTeacherById } from '@/lib/queries';
import { photoUrl } from '@/lib/types';

export const revalidate = 60;

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const teacher = await getTeacherById(id);
  if (!teacher) notFound();

  const t = await getTranslations('profile');
  const tc = await getTranslations('common');
  const to = await getTranslations('options');
  const src = photoUrl(teacher.photo_path);

  const chipList = (keys: string[], ns: string) => (
    <div className="flex flex-wrap gap-2">
      {keys.map((k) => (
        <span key={k} className="rounded-full bg-blush-light px-3 py-1 text-sm">
          {to(`${ns}.${k}`)}
        </span>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-safe sm:px-6 sm:py-10">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {src ? (
          <Image
            src={src}
            alt={teacher.display_name}
            width={160}
            height={160}
            className="size-36 rounded-full object-cover sm:size-40"
          />
        ) : (
          <div className="flex size-36 items-center justify-center rounded-full bg-blush-light text-5xl sm:size-40">
            {teacher.display_name.charAt(0)}
          </div>
        )}
        <div className="w-full text-center sm:text-left">
          <h1 className="heading-brand text-2xl">{teacher.display_name}</h1>
          <p className="mt-1 text-charcoal-soft">
            {teacher.city}, {teacher.country}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <span className="rounded-full bg-blush px-3 py-1 text-sm font-medium">
              {tc('qualitySeal')}
            </span>
            <span className="rounded-full bg-blush-light px-3 py-1 text-sm">
              {to(`selfAssessments.${teacher.self_assessment}`)}
            </span>
            {teacher.online_teaching && (
              <span className="rounded-full bg-blush-light px-3 py-1 text-sm">
                {tc('online')}
              </span>
            )}
          </div>
          <Link
            href={`/anfrage/${teacher.id}`}
            className="btn mt-5 w-full bg-blush text-charcoal transition-transform active:scale-[0.98] sm:w-auto sm:hover:bg-blush-deep"
          >
            {t('requestButton')}
          </Link>
        </div>
      </div>

      {teacher.quality_statement && (
        <section className="mt-10">
          <h2 className="heading-brand mb-3 text-sm">{t('aboutTitle')}</h2>
          <p className="leading-relaxed whitespace-pre-line">{teacher.quality_statement}</p>
        </section>
      )}

      <section className="mt-10">
        <h2 className="heading-brand mb-3 text-sm">{t('experienceTitle')}</h2>
        <ul className="space-y-2 text-sm">
          {teacher.teaching_since !== null && (
            <li>{t('teachingSince', { year: teacher.teaching_since })}</li>
          )}
          {teacher.experience_years !== null && (
            <li>{t('experienceYears', { years: teacher.experience_years })}</li>
          )}
        </ul>
        {teacher.educations && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-medium">{t('educations')}</h3>
            <p className="text-sm whitespace-pre-line text-charcoal-soft">{teacher.educations}</p>
          </div>
        )}
        {teacher.certifications && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-medium">{t('certifications')}</h3>
            <p className="text-sm whitespace-pre-line text-charcoal-soft">{teacher.certifications}</p>
          </div>
        )}
        {teacher.recent_trainings && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-medium">{t('recentTrainings')}</h3>
            <p className="text-sm whitespace-pre-line text-charcoal-soft">{teacher.recent_trainings}</p>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="heading-brand mb-3 text-sm">{t('stylesTitle')}</h2>
        {chipList(teacher.styles, 'styles')}
        {teacher.styles_other && (
          <p className="mt-2 text-sm text-charcoal-soft">{teacher.styles_other}</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="heading-brand mb-3 text-sm">{t('equipmentTitle')}</h2>
        {chipList(teacher.equipment, 'equipment')}
      </section>

      <section className="mt-10">
        <h2 className="heading-brand mb-3 text-sm">{t('offeringsTitle')}</h2>
        {chipList(teacher.offerings, 'offerings')}
      </section>

      <section className="mt-10">
        <h2 className="heading-brand mb-3 text-sm">{t('locationsTitle')}</h2>
        {chipList(teacher.teaching_locations, 'teachingLocations')}
        <ul className="mt-3 space-y-1 text-sm text-charcoal-soft">
          <li>
            {t('location')}: {teacher.city}, {teacher.postal_code}
          </li>
          {teacher.radius_km > 0 && <li>{t('radius', { km: teacher.radius_km })}</li>}
          {teacher.max_distance_km > 0 && (
            <li>{t('maxDistance', { km: teacher.max_distance_km })}</li>
          )}
        </ul>
      </section>
    </div>
  );
}
