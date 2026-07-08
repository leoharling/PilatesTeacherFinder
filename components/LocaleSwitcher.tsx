'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const other = locale === 'de' ? 'en' : 'de';
  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: other })}
      className="flex size-11 items-center justify-center rounded-full border border-blush text-xs uppercase tracking-wider text-charcoal-soft transition-colors active:bg-blush-light sm:hover:bg-blush-light"
      aria-label={other === 'de' ? 'Auf Deutsch wechseln' : 'Switch to English'}
    >
      {other}
    </button>
  );
}
