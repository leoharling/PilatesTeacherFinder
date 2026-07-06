import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('profile');
  const tn = useTranslations('nav');
  return (
    <div className="px-6 py-24 text-center">
      <h1 className="heading-brand text-xl">{t('notFound')}</h1>
      <Link href="/" className="mt-4 inline-block text-blush-deep hover:underline">
        {tn('map')} →
      </Link>
    </div>
  );
}
