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
      <header className="flex items-center justify-between border-b border-blush-light bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="flex items-center gap-3">
            <Image
              src="/images/image-1200x924.png"
              alt="Sandra Leo Pilates Education"
              width={56}
              height={43}
            />
            <span className="heading-brand text-xs">Trainer-CRM</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin" className="hover:text-blush-deep">
              Trainer
            </Link>
            <Link href="/admin/anfragen" className="hover:text-blush-deep">
              Anfragen
            </Link>
          </nav>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-charcoal-soft hover:text-charcoal"
          >
            Abmelden
          </button>
        </form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
