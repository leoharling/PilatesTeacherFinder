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
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
      {status !== 'approved' && (
        <button
          type="button"
          disabled={pending}
          onClick={act(() => updateTeacherStatus(id, 'approved'))}
          className="btn bg-green-600 text-sm text-white sm:hover:bg-green-700"
        >
          Freigeben
        </button>
      )}
      {status !== 'rejected' && (
        <button
          type="button"
          disabled={pending}
          onClick={act(() => updateTeacherStatus(id, 'rejected'))}
          className="btn bg-red-600 text-sm text-white sm:hover:bg-red-700"
        >
          Ablehnen
        </button>
      )}
      {status === 'approved' && (
        <button
          type="button"
          disabled={pending}
          onClick={act(() => updateTeacherStatus(id, 'pending'))}
          className="btn border border-charcoal-soft text-sm sm:hover:bg-blush-light"
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
        className="btn border border-red-300 text-sm text-red-600 sm:hover:bg-red-50"
      >
        Löschen
      </button>
    </div>
  );
}
