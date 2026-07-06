'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { signIn } from '@/app/actions/auth';

export default function AdminLoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await signIn(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="rounded bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          E-Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-md border border-blush px-3 py-2 text-sm focus:border-blush-deep focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-blush px-3 py-2 text-sm focus:border-blush-deep focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-blush px-6 py-3 font-medium text-charcoal hover:bg-blush-deep disabled:opacity-50"
      >
        {pending ? 'Anmelden…' : 'Anmelden'}
      </button>
    </form>
  );
}
