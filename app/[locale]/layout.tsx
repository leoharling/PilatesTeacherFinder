import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import SiteHeader from '@/components/SiteHeader';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      {/* On desktop the shell is pinned to the viewport so the map app fits the
          screen (no whole-page scroll); main scrolls internally for long pages.
          On mobile it grows and the page scrolls naturally. */}
      <div className="flex min-h-screen flex-col lg:h-dvh lg:min-h-0 lg:overflow-hidden">
        <SiteHeader />
        <main className="flex-1 lg:min-h-0 lg:overflow-y-auto">{children}</main>
        <footer className="shrink-0 border-t border-blush-light px-6 py-3 text-center text-xs text-charcoal-soft">
          © Sandra Leo Pilates Education · sandraleopilates.com
        </footer>
      </div>
    </NextIntlClientProvider>
  );
}
