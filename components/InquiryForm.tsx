'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { submitInquiry, type InquiryResult } from '@/app/actions/inquiries';
import { TextField, TextArea } from '@/components/forms';

export default function InquiryForm({ teacherId }: { teacherId: string }) {
  const t = useTranslations('inquiry');
  const tc = useTranslations('common');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  const fieldError = (key: string) => (errors[key] ? tc('error') : undefined);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const result: InquiryResult = await submitInquiry(fd);
        if (result.ok) setSubmitted(true);
        else setErrors(result.errors);
      } catch {
        setErrors({ _form: 'generic' });
      }
    });
  }

  if (submitted) {
    return (
      <div className="rounded-lg bg-blush-light px-8 py-12 text-center">
        <h2 className="heading-brand text-xl">{t('success.title')}</h2>
        <p className="mt-4 text-sm leading-relaxed">{t('success.body')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <input type="hidden" name="teacher_id" value={teacherId} />
      {errors._form && (
        <p className="rounded bg-red-50 px-4 py-3 text-sm text-red-700">{tc('error')}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="studio_name" label={t('fields.studio_name')} required error={fieldError('studio_name')} />
        <TextField name="contact_name" label={t('fields.contact_name')} required error={fieldError('contact_name')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="email" type="email" label={t('fields.email')} required error={fieldError('email')} />
        <TextField name="phone" type="tel" label={t('fields.phone')} error={fieldError('phone')} />
      </div>
      <TextField name="location" label={t('fields.location')} error={fieldError('location')} />
      <TextArea
        name="message"
        label={t('fields.message')}
        required
        rows={6}
        placeholder={t('messagePlaceholder')}
        error={fieldError('message')}
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-blush px-6 py-3 font-medium text-charcoal hover:bg-blush-deep disabled:opacity-50"
      >
        {pending ? tc('sending') : tc('submit')}
      </button>
    </form>
  );
}
