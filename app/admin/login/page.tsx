import Image from 'next/image';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import AdminLoginForm from '@/components/AdminLoginForm';

export default async function AdminLoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/admin');

  return (
    <div className="flex min-h-screen items-center justify-center bg-blush-light/40 px-6">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <Image
          src="/images/image-1200x924.png"
          alt="Sandra Leo Pilates Education"
          width={140}
          height={108}
          className="mx-auto"
        />
        <h1 className="heading-brand mt-4 text-center text-sm">Admin-Bereich</h1>
        <div className="mt-6">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
