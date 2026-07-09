import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getApprovedTeachers, getStudios } from '@/lib/queries';
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
  const [teachers, studios] = await Promise.all([
    getApprovedTeachers(),
    getStudios(),
  ]);
  return (
    <div className="lg:h-full">
      <h1 className="sr-only">{t('title')}</h1>
      <MapExplorer teachers={teachers} studios={studios} />
    </div>
  );
}
