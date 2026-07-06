'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { TeacherPublicRow } from '@/lib/types';
import { photoUrl } from '@/lib/types';

export default function TeacherCard({ teacher }: { teacher: TeacherPublicRow }) {
  const t = useTranslations('home');
  const tc = useTranslations('common');
  const to = useTranslations('options');
  const src = photoUrl(teacher.photo_path);
  return (
    <div className="flex gap-4 rounded-lg border border-blush-light bg-white p-4 shadow-sm">
      {src ? (
        <Image
          src={src}
          alt={teacher.display_name}
          width={72}
          height={72}
          className="h-18 w-18 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-18 w-18 items-center justify-center rounded-full bg-blush-light text-xl">
          {teacher.display_name.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{teacher.display_name}</p>
        <p className="text-sm text-charcoal-soft">
          {teacher.city}
          {teacher.radius_km > 0 ? ` · ${teacher.radius_km} ${tc('km')}` : ''}
        </p>
        <p className="mt-1 truncate text-xs text-charcoal-soft">
          {teacher.styles.map((s) => to(`styles.${s}`)).join(' · ')}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blush-light px-2 py-0.5 text-[11px]">
            {tc('qualitySeal')}
          </span>
          {teacher.online_teaching && (
            <span className="rounded-full bg-blush-light px-2 py-0.5 text-[11px]">
              {tc('online')}
            </span>
          )}
          {teacher.experience_years !== null && (
            <span className="text-[11px] text-charcoal-soft">
              {t('experienceYears', { years: teacher.experience_years })}
            </span>
          )}
        </div>
        <Link
          href={`/trainer/${teacher.id}`}
          className="mt-2 inline-block text-sm font-medium text-blush-deep hover:underline"
        >
          {t('viewProfile')} →
        </Link>
      </div>
    </div>
  );
}
