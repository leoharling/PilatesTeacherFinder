import { getTranslations, setRequestLocale } from 'next-intl/server';
import IntakeForm from '@/components/IntakeForm';

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('intake');
  return (
    <div className="px-4 py-8 pb-safe sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="heading-brand text-xl sm:text-2xl">{t('title')}</h1>
        <p className="mt-3 text-sm text-charcoal-soft">{t('subtitle')}</p>
      </div>
      <div className="mt-8">
        <IntakeForm />
      </div>
    </div>
  );
}
