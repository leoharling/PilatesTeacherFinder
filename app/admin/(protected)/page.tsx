import Image from 'next/image';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { TeacherRow } from '@/lib/types';
import { photoUrl } from '@/lib/types';
import { StatusBadge, ADMIN_LABELS, labelList } from '@/components/admin/StatusBadge';

const STATUS_ORDER = { pending: 0, approved: 1, rejected: 2 } as const;

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('teachers')
    .select('*')
    .order('created_at', { ascending: false });
  let teachers = (data ?? []) as TeacherRow[];
  if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
    teachers = teachers.filter((t) => t.status === statusFilter);
  } else {
    teachers = [...teachers].sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    );
  }
  const pendingCount = (data ?? []).filter((t) => t.status === 'pending').length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="heading-brand text-lg">
          Trainer ({teachers.length}
          {pendingCount > 0 ? ` · ${pendingCount} neu` : ''})
        </h1>
        <div className="flex gap-2 text-sm">
          {(
            [
              { href: '/admin', label: 'Alle', match: undefined },
              { href: '/admin?status=pending', label: 'Neu', match: 'pending' },
              { href: '/admin?status=approved', label: 'Freigegeben', match: 'approved' },
              { href: '/admin?status=rejected', label: 'Abgelehnt', match: 'rejected' },
            ] as const
          ).map((chip) => {
            const isActive = chip.match === statusFilter;
            return (
              <Link
                key={chip.href}
                href={chip.href}
                className={
                  isActive
                    ? 'rounded-full border border-blush-deep bg-blush px-3 py-1 text-charcoal'
                    : 'rounded-full border border-blush px-3 py-1 hover:bg-blush-light'
                }
              >
                {chip.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-blush-light bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blush-light text-left text-xs uppercase tracking-wider text-charcoal-soft">
              <th className="px-4 py-3">Foto</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Ort</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Stile</th>
              <th className="px-4 py-3">Erfahrung</th>
              <th className="px-4 py-3">Eingereicht</th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-charcoal-soft">
                  Keine Trainer vorhanden.
                </td>
              </tr>
            )}
            {teachers.map((t) => {
              const src = photoUrl(t.photo_path);
              return (
                <tr key={t.id} className="relative border-b border-blush-light/60 last:border-0 hover:bg-blush-light/40">
                  <td className="px-4 py-2">
                    {src ? (
                      <Image src={src} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-blush-light" />
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/admin/trainer/${t.id}`} className="after:absolute after:inset-0">
                      {t.first_name} {t.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {t.postal_code} {t.city}
                    {t.lat === null && (
                      <span title="Standort nicht gefunden — bitte prüfen" className="ml-1 text-amber-600">⚠</span>
                    )}
                  </td>
                  <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                  <td className="max-w-56 truncate px-4 py-2 text-charcoal-soft">
                    {labelList(t.styles, ADMIN_LABELS.styles)}
                  </td>
                  <td className="px-4 py-2 text-charcoal-soft">
                    {t.experience_years !== null ? `${t.experience_years} J.` : '—'}
                  </td>
                  <td className="px-4 py-2 text-charcoal-soft">
                    {new Date(t.created_at).toLocaleDateString('de-DE')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
