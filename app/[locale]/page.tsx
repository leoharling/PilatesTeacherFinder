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
      <div className="border-b border-blush-light px-6 py-6 text-center">
        <h1 className="heading-brand text-xl sm:text-2xl">{t('title')}</h1>
        <p className="mt-2 text-sm text-charcoal-soft">{t('subtitle')}</p>
      </div>
      <MapExplorer teachers={teachers} />
    </div>
  );
}
