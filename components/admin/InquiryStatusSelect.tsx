'use client';

import { useTransition } from 'react';
import { updateInquiryStatus } from '@/app/actions/admin';
import type { InquiryStatus } from '@/lib/types';

export default function InquiryStatusSelect({
  id,
  status,
}: {
  id: string;
  status: InquiryStatus;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) =>
        startTransition(() =>
          updateInquiryStatus(id, e.target.value as InquiryStatus)
        )
      }
      className="rounded-md border border-blush px-2 py-1 text-sm"
    >
      <option value="new">Neu</option>
      <option value="contacted">Kontaktiert</option>
      <option value="placed">Vermittelt</option>
    </select>
  );
}
