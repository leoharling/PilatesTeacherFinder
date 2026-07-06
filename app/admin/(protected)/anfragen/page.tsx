import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { InquiryRow } from '@/lib/types';
import { InquiryStatusBadge } from '@/components/admin/StatusBadge';
import InquiryStatusSelect from '@/components/admin/InquiryStatusSelect';

interface InquiryWithTeacher extends InquiryRow {
  teachers: { first_name: string; last_name: string; city: string } | null;
}

export default async function AdminInquiriesPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('inquiries')
    .select('*, teachers(first_name, last_name, city)')
    .order('created_at', { ascending: false });
  const inquiries = (data ?? []) as unknown as InquiryWithTeacher[];

  return (
    <div>
      <h1 className="heading-brand mb-4 text-lg">Anfragen ({inquiries.length})</h1>
      <div className="space-y-4">
        {inquiries.length === 0 && (
          <p className="text-sm text-charcoal-soft">Noch keine Anfragen.</p>
        )}
        {inquiries.map((q) => (
          <div key={q.id} className="rounded-lg border border-blush-light bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {q.studio_name}
                  {q.location ? ` · ${q.location}` : ''}
                </p>
                <p className="text-sm text-charcoal-soft">
                  {q.contact_name} ·{' '}
                  <a href={`mailto:${q.email}`} className="text-blush-deep hover:underline">
                    {q.email}
                  </a>
                  {q.phone ? ` · ${q.phone}` : ''}
                </p>
                <p className="mt-1 text-sm">
                  Für:{' '}
                  {q.teachers ? (
                    <Link href={`/admin/trainer/${q.teacher_id}`} className="text-blush-deep hover:underline">
                      {q.teachers.first_name} {q.teachers.last_name} ({q.teachers.city})
                    </Link>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <InquiryStatusBadge status={q.status} />
                <InquiryStatusSelect id={q.id} status={q.status} />
              </div>
            </div>
            <p className="mt-3 rounded bg-blush-light/50 p-3 text-sm whitespace-pre-line">
              {q.message}
            </p>
            <p className="mt-2 text-xs text-charcoal-soft">
              {new Date(q.created_at).toLocaleString('de-DE')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
