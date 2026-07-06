'use client';

import { useTransition } from 'react';
import { updateTeacherStatus, deleteTeacher } from '@/app/actions/admin';
import type { TeacherStatus } from '@/lib/types';

export default function TeacherActions({
  id,
  status,
}: {
  id: string;
  status: TeacherStatus;
}) {
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<void>) => () => startTransition(fn);

  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'approved' && (
        <button
          type="button"
          disabled={pending}
          onClick={act(() => updateTeacherStatus(id, 'approved'))}
          className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Freigeben
        </button>
      )}
      {status !== 'rejected' && (
        <button
          type="button"
          disabled={pending}
          onClick={act(() => updateTeacherStatus(id, 'rejected'))}
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Ablehnen
        </button>
      )}
      {status === 'approved' && (
        <button
          type="button"
          disabled={pending}
          onClick={act(() => updateTeacherStatus(id, 'pending'))}
          className="rounded-full border border-charcoal-soft px-4 py-2 text-sm hover:bg-blush-light disabled:opacity-50"
        >
          Zurückziehen
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm('Diesen Trainer endgültig löschen?')) {
            startTransition(() => deleteTeacher(id));
          }
        }}
        className="rounded-full border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Löschen
      </button>
    </div>
  );
}
