'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { TeacherPublicRow } from '@/lib/types';
import { photoUrl } from '@/lib/types';

export default function TeacherCard({
  teacher,
  onClose,
  onLocate,
}: {
  teacher: TeacherPublicRow;
  onClose?: () => void;
  onLocate?: () => void;
}) {
  const t = useTranslations('home');
  const tc = useTranslations('common');
  const to = useTranslations('options');
  const src = photoUrl(teacher.photo_path);
  return (
    <div
      onClick={onLocate}
      className={`relative flex gap-4 rounded-2xl border border-blush-light bg-white p-4 shadow-sm ${
        onLocate ? 'cursor-pointer transition-colors sm:hover:border-blush' : ''
      }`}
    >
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label={tc('back')}
          className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-charcoal-soft transition-colors active:bg-blush-light"
        >
          ✕
        </button>
      )}
      {src ? (
        <Image
          src={src}
          alt={teacher.display_name}
          width={72}
          height={72}
          className="size-18 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex size-18 shrink-0 items-center justify-center rounded-full bg-blush-light text-xl">
          {teacher.display_name.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="pr-6 font-medium">{teacher.display_name}</p>
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
        </div>
        <Link
          href={`/trainer/${teacher.id}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-3 flex min-h-10 items-center justify-center rounded-full bg-blush px-4 text-sm font-medium text-charcoal transition-transform active:scale-[0.98] sm:inline-flex sm:hover:bg-blush-deep"
        >
          {t('viewProfile')}
        </Link>
      </div>
    </div>
  );
}
