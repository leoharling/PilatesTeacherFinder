import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import LocaleSwitcher from '@/components/LocaleSwitcher';

export default function SiteHeader() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  return (
    <header className="flex items-center justify-between gap-4 border-b border-blush-light bg-white px-6 py-3">
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/images/image-1200x924.png"
          alt="Sandra Leo Pilates Education"
          width={72}
          height={55}
          priority
        />
        <span className="heading-brand hidden text-sm text-charcoal sm:block">
          {tc('appName')}
        </span>
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        <Link href="/" className="hover:text-blush-deep">
          {t('map')}
        </Link>
        <Link
          href="/registrieren"
          className="rounded-full bg-blush px-4 py-2 font-medium text-charcoal hover:bg-blush-deep"
        >
          {t('register')}
        </Link>
        <LocaleSwitcher />
      </nav>
    </header>
  );
}
