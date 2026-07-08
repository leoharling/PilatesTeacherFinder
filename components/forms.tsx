'use client';

import type { ReactNode } from 'react';

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="heading-brand mt-8 mb-4 border-b border-blush-light pb-2 text-sm text-charcoal sm:mt-10">
      {children}
    </h2>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-sm text-red-600">{children}</p>;
}

const inputClass =
  'w-full rounded-xl border border-blush bg-white px-4 py-3 text-base transition-colors focus:border-blush-deep focus:outline-none focus:ring-2 focus:ring-blush/60 aria-[invalid=true]:border-red-400';

export function TextField(props: {
  name: string;
  label: string;
  error?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  const { name, label, error, type = 'text', required, placeholder, defaultValue } = props;
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={inputClass}
        aria-invalid={!!error}
      />
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export function TextArea(props: {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const { name, label, error, required, rows = 4, placeholder } = props;
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? ' *' : ''}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        placeholder={placeholder}
        className={inputClass}
        aria-invalid={!!error}
      />
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export function CheckboxGroup(props: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  error?: string;
}) {
  const { name, label, options, error } = props;
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-medium">{label} *</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-blush-light px-4 text-sm transition-colors has-[:checked]:border-blush-deep has-[:checked]:bg-blush-light active:bg-blush-light"
          >
            <input
              type="checkbox"
              name={name}
              value={o.value}
              className="size-5 shrink-0 accent-blush-deep"
            />
            {o.label}
          </label>
        ))}
      </div>
      <ErrorText>{error}</ErrorText>
    </fieldset>
  );
}

export function RadioGroup(props: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  error?: string;
}) {
  const { name, label, options, error } = props;
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-medium">{label} *</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border border-blush-light px-4 text-sm transition-colors has-[:checked]:border-blush-deep has-[:checked]:bg-blush-light active:bg-blush-light"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              className="size-5 shrink-0 accent-blush-deep"
            />
            {o.label}
          </label>
        ))}
      </div>
      <ErrorText>{error}</ErrorText>
    </fieldset>
  );
}
