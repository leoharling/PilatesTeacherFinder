import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('profile');
  const tn = useTranslations('nav');
  return (
    <div className="px-4 py-24 text-center sm:px-6">
      <h1 className="heading-brand text-xl">{t('notFound')}</h1>
      <Link
        href="/"
        className="btn mx-auto mt-6 w-full max-w-xs bg-blush text-charcoal sm:w-auto sm:hover:bg-blush-deep"
      >
        {tn('map')} →
      </Link>
    </div>
  );
}
