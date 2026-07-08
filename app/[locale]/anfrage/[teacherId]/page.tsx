import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getTeacherById } from '@/lib/queries';
import InquiryForm from '@/components/InquiryForm';

export default async function InquiryPage({
  params,
}: {
  params: Promise<{ locale: string; teacherId: string }>;
}) {
  const { locale, teacherId } = await params;
  setRequestLocale(locale);
  const teacher = await getTeacherById(teacherId);
  if (!teacher) notFound();
  const t = await getTranslations('inquiry');
  return (
    <div className="mx-auto max-w-xl px-4 py-8 pb-safe sm:px-6 sm:py-10">
      <h1 className="heading-brand text-center text-xl sm:text-2xl">{t('title')}</h1>
      <p className="mt-3 text-center text-sm text-charcoal-soft">{t('subtitle')}</p>
      <p className="mt-2 text-center text-sm font-medium">
        {t('forTeacher', { name: teacher.display_name, city: teacher.city })}
      </p>
      <div className="mt-8">
        <InquiryForm teacherId={teacher.id} />
      </div>
    </div>
  );
}
