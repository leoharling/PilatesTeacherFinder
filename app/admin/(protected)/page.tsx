import Image from 'next/image';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { TeacherRow } from '@/lib/types';
import { photoUrl } from '@/lib/types';
import { StatusBadge, ADMIN_LABELS, labelList } from '@/components/admin/StatusBadge';

const STATUS_ORDER = { pending: 0, approved: 1, rejected: 2 } as const;

const FILTERS = [
  { href: '/admin', label: 'Alle', match: undefined },
  { href: '/admin?status=pending', label: 'Neu', match: 'pending' },
  { href: '/admin?status=approved', label: 'Freigegeben', match: 'approved' },
  { href: '/admin?status=rejected', label: 'Abgelehnt', match: 'rejected' },
] as const;

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
      <h1 className="heading-brand text-lg">
        Trainer ({teachers.length}
        {pendingCount > 0 ? ` · ${pendingCount} neu` : ''})
      </h1>

      <div className="mt-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((chip) => {
          const isActive = chip.match === statusFilter;
          return (
            <Link
              key={chip.href}
              href={chip.href}
              className={`flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm transition-colors ${
                isActive
                  ? 'border-blush-deep bg-blush font-medium text-charcoal'
                  : 'border-blush text-charcoal-soft active:bg-blush-light sm:hover:bg-blush-light'
              }`}
            >
              {chip.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-blush-light bg-white">
        {teachers.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-charcoal-soft">
            Keine Trainer vorhanden.
          </p>
        ) : (
          <ul className="divide-y divide-blush-light">
            {teachers.map((t) => {
              const src = photoUrl(t.photo_path);
              return (
                <li key={t.id}>
                  <Link href={`/admin/trainer/${t.id}`} className="list-row">
                    {src ? (
                      <Image
                        src={src}
                        alt=""
                        width={48}
                        height={48}
                        className="size-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blush-light text-charcoal-soft">
                        {t.first_name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">
                          {t.first_name} {t.last_name}
                        </p>
                        {t.lat === null && (
                          <span
                            title="Standort nicht gefunden — bitte prüfen"
                            className="shrink-0 text-amber-600"
                          >
                            ⚠
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-charcoal-soft">
                        {t.postal_code} {t.city}
                        {t.experience_years !== null ? ` · ${t.experience_years} J.` : ''}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-charcoal-soft">
                        {labelList(t.styles, ADMIN_LABELS.styles)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={t.status} />
                      <span className="text-blush-deep" aria-hidden>
                        ›
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
