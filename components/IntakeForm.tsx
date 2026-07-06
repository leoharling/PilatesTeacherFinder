'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import {
  submitTeacherApplication,
  type IntakeResult,
} from '@/app/actions/teachers';
import { downscaleImage } from '@/lib/image';
import {
  GENDERS,
  STYLES,
  EQUIPMENT,
  OFFERINGS,
  TEACHING_LOCATIONS,
  SELF_ASSESSMENTS,
} from '@/lib/options';
import {
  SectionHeading,
  TextField,
  TextArea,
  CheckboxGroup,
  RadioGroup,
  ErrorText,
} from '@/components/forms';

export default function IntakeForm() {
  const t = useTranslations('intake');
  const to = useTranslations('options');
  const tc = useTranslations('common');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  const fieldError = (key: string) =>
    errors[key] ? t('errors.field') : undefined;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    startTransition(async () => {
      const fd = new FormData(form);
      const photo = fd.get('photo');
      if (photo instanceof File && photo.size > 0) {
        try {
          const small = await downscaleImage(photo);
          fd.set('photo', small, 'photo.jpg');
        } catch {
          // keep original file if downscaling fails; server enforces limits
        }
      }
      try {
        const result: IntakeResult = await submitTeacherApplication(fd);
        if (result.ok) {
          setSubmitted(true);
          window.scrollTo({ top: 0 });
        } else {
          setErrors(result.errors);
        }
      } catch {
        setErrors({ _form: 'generic' });
      }
    });
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl rounded-lg bg-blush-light px-8 py-12 text-center">
        <h2 className="heading-brand text-xl">{t('success.title')}</h2>
        <p className="mt-4 text-sm leading-relaxed">{t('success.body')}</p>
      </div>
    );
  }

  const opts = (keys: readonly string[], ns: string) =>
    keys.map((k) => ({ value: k, label: to(`${ns}.${k}`) }));

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-2xl">
      {errors._form && (
        <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          {tc('error')}
        </p>
      )}
      {Object.keys(errors).length > 0 && !errors._form && (
        <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('errors.generic')}
        </p>
      )}

      <SectionHeading>{t('sections.personal')}</SectionHeading>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="first_name" label={t('fields.first_name')} required error={fieldError('first_name')} />
        <TextField name="last_name" label={t('fields.last_name')} required error={fieldError('last_name')} />
      </div>
      <div className="mt-4">
        <RadioGroup name="gender" label={t('fields.gender')} options={opts(GENDERS, 'genders')} error={fieldError('gender')} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField name="email" type="email" label={t('fields.email')} required error={fieldError('email')} />
        <TextField name="phone" type="tel" label={t('fields.phone')} required error={fieldError('phone')} />
      </div>
      <div className="mt-4">
        <TextField name="website_instagram" label={t('fields.website_instagram')} error={fieldError('website_instagram')} />
      </div>

      <SectionHeading>{t('sections.location')}</SectionHeading>
      <TextField name="location_name" label={t('fields.location_name')} required error={fieldError('location_name')} />
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <TextField name="postal_code" label={t('fields.postal_code')} required error={fieldError('postal_code')} />
        <TextField name="city" label={t('fields.city')} required error={fieldError('city')} />
        <TextField name="country" label={t('fields.country')} required defaultValue="Deutschland" error={fieldError('country')} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField name="radius_km" type="number" label={t('fields.radius_km')} required error={fieldError('radius_km')} />
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="online_teaching" value="true" className="accent-blush-deep" />
          {t('fields.online_teaching')}
        </label>
      </div>

      <SectionHeading>{t('sections.styles')}</SectionHeading>
      <CheckboxGroup name="styles" label={t('fields.styles')} options={opts(STYLES, 'styles')} error={fieldError('styles')} />
      <div className="mt-4">
        <TextField name="styles_other" label={t('fields.styles_other')} error={fieldError('styles_other')} />
      </div>

      <SectionHeading>{t('sections.equipment')}</SectionHeading>
      <CheckboxGroup name="equipment" label={t('fields.equipment')} options={opts(EQUIPMENT, 'equipment')} error={fieldError('equipment')} />

      <SectionHeading>{t('sections.experience')}</SectionHeading>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="teaching_since" type="number" label={t('fields.teaching_since')} required error={fieldError('teaching_since')} />
        <TextField name="experience_years" type="number" label={t('fields.experience_years')} required error={fieldError('experience_years')} />
      </div>
      <div className="mt-4 space-y-4">
        <TextArea name="educations" label={t('fields.educations')} required error={fieldError('educations')} />
        <TextArea name="certifications" label={t('fields.certifications')} error={fieldError('certifications')} />
        <TextArea name="recent_trainings" label={t('fields.recent_trainings')} error={fieldError('recent_trainings')} />
      </div>

      <SectionHeading>{t('sections.quality')}</SectionHeading>
      <RadioGroup name="self_assessment" label={t('fields.self_assessment')} options={opts(SELF_ASSESSMENTS, 'selfAssessments')} error={fieldError('self_assessment')} />
      <div className="mt-4">
        <TextArea name="quality_statement" label={t('fields.quality_statement')} required rows={5} error={fieldError('quality_statement')} />
      </div>

      <SectionHeading>{t('sections.offerings')}</SectionHeading>
      <CheckboxGroup name="offerings" label={t('fields.offerings')} options={opts(OFFERINGS, 'offerings')} error={fieldError('offerings')} />

      <SectionHeading>{t('sections.teachingLocations')}</SectionHeading>
      <CheckboxGroup name="teaching_locations" label={t('fields.teaching_locations')} options={opts(TEACHING_LOCATIONS, 'teachingLocations')} error={fieldError('teaching_locations')} />
      <div className="mt-4">
        <TextField name="max_distance_km" type="number" label={t('fields.max_distance_km')} required error={fieldError('max_distance_km')} />
      </div>

      <SectionHeading>{t('sections.photo')}</SectionHeading>
      <label htmlFor="photo" className="mb-1 block text-sm font-medium">
        {t('fields.photo')} *
      </label>
      <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
      <p className="mt-1 text-xs text-charcoal-soft">{t('photoHint')}</p>
      <ErrorText>{errors.photo ? t(`errors.${errors.photo}`) : undefined}</ErrorText>

      <SectionHeading>{t('sections.confirm')}</SectionHeading>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirmed" value="true" className="mt-1 accent-blush-deep" />
        {t('fields.confirmed')}
      </label>
      <ErrorText>{fieldError('confirmed')}</ErrorText>

      <p className="mt-6 text-xs text-charcoal-soft">{tc('requiredHint')}</p>
      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-full bg-blush px-6 py-3 font-medium text-charcoal hover:bg-blush-deep disabled:opacity-50"
      >
        {pending ? tc('sending') : tc('submit')}
      </button>
    </form>
  );
}
