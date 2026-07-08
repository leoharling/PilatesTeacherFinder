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
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          E-Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-xl border border-blush px-4 py-3 text-base focus:border-blush-deep focus:outline-none focus:ring-2 focus:ring-blush/60"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-xl border border-blush px-4 py-3 text-base focus:border-blush-deep focus:outline-none focus:ring-2 focus:ring-blush/60"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn w-full bg-blush text-charcoal sm:hover:bg-blush-deep"
      >
        {pending ? 'Anmelden…' : 'Anmelden'}
      </button>
    </form>
  );
}
