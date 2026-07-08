import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import LocaleSwitcher from '@/components/LocaleSwitcher';

export default function SiteHeader() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-blush-light bg-white/90 px-4 py-2.5 backdrop-blur-md sm:px-6 sm:py-3">
      <Link href="/" className="flex shrink-0 items-center gap-2 sm:gap-3">
        <Image
          src="/images/image-1200x924.png"
          alt="Sandra Leo Pilates Education"
          width={72}
          height={55}
          priority
          className="h-9 w-auto sm:h-11"
        />
        <span className="heading-brand hidden text-sm text-charcoal sm:block">
          {tc('appName')}
        </span>
      </Link>
      <nav className="flex items-center gap-2 sm:gap-4">
        <Link
          href="/registrieren"
          className="btn bg-blush text-sm text-charcoal sm:hover:bg-blush-deep"
        >
          {t('register')}
        </Link>
        <LocaleSwitcher />
      </nav>
    </header>
  );
}
