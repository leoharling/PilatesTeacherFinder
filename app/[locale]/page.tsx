import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getApprovedTeachers } from '@/lib/queries';
import MapExplorer from '@/components/MapExplorer';

export const revalidate = 60;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const teachers = await getApprovedTeachers();
  return (
    <div>
      <div className="border-b border-blush-light px-4 py-4 text-center sm:px-6 sm:py-6">
        <h1 className="heading-brand text-lg sm:text-2xl">{t('title')}</h1>
        <p className="mt-1.5 text-sm text-charcoal-soft sm:mt-2">{t('subtitle')}</p>
      </div>
      <MapExplorer teachers={teachers} />
    </div>
  );
}
