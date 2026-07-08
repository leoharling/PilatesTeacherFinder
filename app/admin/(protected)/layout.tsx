import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  return (
    <div className="min-h-screen bg-blush-light/30">
      <header className="sticky top-0 z-40 border-b border-blush-light bg-white/90 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/admin" className="flex items-center gap-2 sm:gap-3">
              <Image
                src="/images/image-1200x924.png"
                alt="Sandra Leo Pilates Education"
                width={56}
                height={43}
                className="h-8 w-auto sm:h-9"
              />
              <span className="heading-brand text-xs">Trainer-CRM</span>
            </Link>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex min-h-9 items-center rounded-full px-3 text-sm text-charcoal-soft transition-colors active:bg-blush-light sm:hover:text-charcoal"
            >
              Abmelden
            </button>
          </form>
        </div>
        <nav className="flex gap-1 px-4 pb-1 text-sm sm:px-6">
          <Link
            href="/admin"
            className="flex min-h-10 items-center rounded-full px-3 font-medium text-charcoal transition-colors active:bg-blush-light sm:hover:bg-blush-light"
          >
            Trainer
          </Link>
          <Link
            href="/admin/anfragen"
            className="flex min-h-10 items-center rounded-full px-3 font-medium text-charcoal transition-colors active:bg-blush-light sm:hover:bg-blush-light"
          >
            Anfragen
          </Link>
        </nav>
      </header>
      <main className="p-4 sm:p-6">{children}</main>
    </div>
  );
}
