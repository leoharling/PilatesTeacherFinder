import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('home');
  return (
    <div className="px-6 py-16 text-center">
      <h1 className="heading-brand text-2xl">{t('title')}</h1>
      <p className="mt-3 text-charcoal-soft">{t('subtitle')}</p>
    </div>
  );
}
