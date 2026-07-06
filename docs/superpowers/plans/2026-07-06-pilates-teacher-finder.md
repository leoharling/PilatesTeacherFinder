# Pilates Teacher Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Pilates Teacher Finder — a bilingual (DE/EN) Next.js app where pilates teachers apply via an intake form, Sandra approves them in a CRM-style admin, approved teachers appear on a public map of Germany, and studios send gated inquiries that route through Sandra.

**Architecture:** One Next.js 16 App Router app (already scaffolded). All privileged operations (intake insert, photo upload, geocoding, emails, admin mutations) run in server actions. The browser reads public data only through a `teachers_public` Postgres view that omits contact data. Supabase provides Postgres + Auth + Storage; migrations live in `supabase/migrations/`. Public pages are localized under `/[locale]` via next-intl; the admin CRM lives outside the locale tree at `/admin`, German-only, guarded by Supabase Auth.

**Tech Stack:** Next.js 16 (App Router, Tailwind v4, TypeScript), next-intl v4, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Leaflet + leaflet.markercluster (imperative, no react-leaflet), zod v4, Resend, vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-06-pilates-teacher-finder-design.md` — authoritative for scope.
- Supabase project ref: `olgrifbkczkrqpsuxych`. Repo remote: `https://github.com/leoharling/PilatesTeacherFinder.git` (already set as `origin`).
- Locales: `de` (default) and `en`. Admin (`/admin/*`) is **not** localized — German UI strings hardcoded.
- Contact data (email, phone, full last name, website/Instagram) must NEVER appear in any public payload, page, or client bundle. Public display name = `Vorname + first letter of Nachname + "."`.
- `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` are server-only — never import service/resend modules into client components.
- Brand: soft pink `#F5C6D8` (accent `#E8A8C4`, light `#FBE9F1`), charcoal `#3A3A3A`, white background, letter-spaced uppercase headings. Logo assets: `public/images/image-1200x924.png` (pink wordmark), `public/images/images.jpg` (icon).
- Multi-select values stored in DB as canonical slug keys (defined in `lib/options.ts`), translated only at display time.
- Node 20+, npm. Commit after every task with the exact message given.
- All commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Supabase schema, migrations, storage bucket

**Files:**
- Create: `supabase/migrations/20260706000001_init.sql`
- Created by CLI: `supabase/config.toml` (via `supabase init`)

**Interfaces:**
- Produces: tables `public.teachers`, `public.inquiries`; view `public.teachers_public` (columns listed in Step 2 — later tasks' TypeScript row types must match exactly); storage bucket `teacher-photos` (public read).

- [ ] **Step 1: Initialize supabase folder and link project**

```bash
supabase init
supabase link --project-ref olgrifbkczkrqpsuxych
```

If `link` fails with an auth error, ask the user to run `! supabase login` in the session, then retry. (`supabase` CLI is installed; check with `supabase --version`, and if missing ask the user to run `! brew install supabase/tap/supabase`.)

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260706000001_init.sql`:

```sql
-- Teachers: full intake record. Contact fields are private (RLS, no anon access).
create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),

  -- Persönliche Angaben
  first_name text not null,
  last_name text not null,
  gender text not null,
  email text not null,
  phone text not null,
  website_instagram text not null default '',

  -- Standort
  location_name text not null,
  postal_code text not null,
  city text not null,
  country text not null default 'Deutschland',
  radius_km integer not null default 0,
  online_teaching boolean not null default false,

  -- Stil & Geräte (canonical slug keys from lib/options.ts)
  styles text[] not null default '{}',
  styles_other text not null default '',
  equipment text[] not null default '{}',

  -- Erfahrung
  teaching_since integer,
  experience_years integer,
  educations text not null default '',
  certifications text not null default '',
  recent_trainings text not null default '',

  -- Qualitätsprofil
  self_assessment text not null,
  quality_statement text not null default '',

  -- Angebot & Orte
  offerings text[] not null default '{}',
  teaching_locations text[] not null default '{}',
  max_distance_km integer not null default 0,

  -- Media & Geo
  photo_path text,
  lat double precision,
  lng double precision
);

create extension if not exists moddatetime schema extensions;
create trigger teachers_updated_at
  before update on public.teachers
  for each row execute procedure extensions.moddatetime(updated_at);

alter table public.teachers enable row level security;

-- Admin (any authenticated user = Sandra) gets full access. Anon gets nothing;
-- inserts from the intake form go through the server with the service role.
create policy "authenticated full access" on public.teachers
  for all to authenticated using (true) with check (true);

-- Public read model: approved teachers only, no contact data.
create view public.teachers_public
  with (security_invoker = off) as
  select
    id,
    first_name || ' ' || left(last_name, 1) || '.' as display_name,
    city,
    postal_code,
    country,
    radius_km,
    online_teaching,
    styles,
    styles_other,
    equipment,
    teaching_since,
    experience_years,
    educations,
    certifications,
    recent_trainings,
    self_assessment,
    quality_statement,
    offerings,
    teaching_locations,
    max_distance_km,
    photo_path,
    lat,
    lng,
    created_at
  from public.teachers
  where status = 'approved';

grant select on public.teachers_public to anon, authenticated;

-- Studio inquiries: written by server (service role), read/updated by admin.
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  studio_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null default '',
  location text not null default '',
  message text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'placed'))
);

alter table public.inquiries enable row level security;

create policy "authenticated full access" on public.inquiries
  for all to authenticated using (true) with check (true);

-- Public bucket for teacher photos (uploads happen server-side only).
insert into storage.buckets (id, name, public)
values ('teacher-photos', 'teacher-photos', true)
on conflict (id) do nothing;
```

- [ ] **Step 3: Push the migration**

```bash
supabase db push
```

Expected: `Applying migration 20260706000001_init.sql... Finished supabase db push.`

- [ ] **Step 4: Verify schema**

```bash
supabase db diff --linked
```

Expected: `No schema changes found` (or empty diff). Additionally sanity-check the view exists:

```bash
echo "select count(*) from public.teachers_public;" | supabase db query 2>/dev/null || true
```

(If `db query` is unavailable in the installed CLI version, skip — the diff check suffices.)

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema — teachers, inquiries, public view, photo bucket"
```

---

### Task 2: Dependencies, env vars, Supabase clients, domain constants/types

**Files:**
- Create: `.env.local` (values from user/Supabase), `.env.example`
- Create: `lib/supabase/server.ts`, `lib/supabase/service.ts`, `lib/supabase/public.ts`
- Create: `lib/options.ts`, `lib/types.ts`
- Modify: `package.json` (deps), `.gitignore` (ensure `.env*` ignored — create-next-app default already has it)

**Interfaces:**
- Produces:
  - `createSupabaseServerClient(): Promise<SupabaseClient>` (cookie-bound, for admin auth) from `lib/supabase/server.ts`
  - `createSupabaseServiceClient(): SupabaseClient` (service role) from `lib/supabase/service.ts`
  - `createSupabasePublicClient(): SupabaseClient` (anon, no cookies) from `lib/supabase/public.ts`
  - Constants `STYLES`, `EQUIPMENT`, `OFFERINGS`, `TEACHING_LOCATIONS`, `SELF_ASSESSMENTS`, `GENDERS` from `lib/options.ts`
  - Types `TeacherRow`, `TeacherPublicRow`, `InquiryRow`, `TeacherStatus`, `InquiryStatus` from `lib/types.ts`
  - `photoUrl(path: string | null): string | null` from `lib/types.ts`

- [ ] **Step 1: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr next-intl zod resend leaflet leaflet.markercluster
npm install -D vitest @types/leaflet @types/leaflet.markercluster
```

- [ ] **Step 2: Create env files**

`.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://olgrifbkczkrqpsuxych.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# Optional — inquiry email notifications are skipped if unset
RESEND_API_KEY=
INQUIRY_NOTIFY_EMAIL=
```

Create `.env.local` with the same keys. Fill `NEXT_PUBLIC_SUPABASE_URL`. For the two Supabase keys, try `supabase projects api-keys --project-ref olgrifbkczkrqpsuxych`; if that requires re-auth, ask the user to paste the anon and service_role keys from the Supabase dashboard (Settings → API). Verify `.gitignore` covers `.env*` (create-next-app default does).

- [ ] **Step 3: Write options and types**

`lib/options.ts`:

```ts
export const GENDERS = ['female', 'male', 'diverse'] as const;

export const STYLES = [
  'classical',
  'contemporary',
  'rehab',
  'athletic',
  'prepostnatal',
  'seniors',
  'other',
] as const;

export const EQUIPMENT = [
  'mat',
  'reformer',
  'cadillac',
  'chair',
  'ladder_barrel',
  'spine_corrector',
  'springboard',
  'tower',
  'small_props',
] as const;

export const OFFERINGS = [
  'personal_training',
  'duet',
  'small_groups',
  'group_classes',
  'workshops',
  'teacher_training',
  'online',
] as const;

export const TEACHING_LOCATIONS = [
  'own_studio',
  'other_studio',
  'gym',
  'physio_practice',
  'clients_home',
  'online',
] as const;

export const SELF_ASSESSMENTS = [
  'beginner',
  'advanced',
  'very_experienced',
  'expert',
] as const;

export type Gender = (typeof GENDERS)[number];
export type Style = (typeof STYLES)[number];
export type Equipment = (typeof EQUIPMENT)[number];
export type Offering = (typeof OFFERINGS)[number];
export type TeachingLocation = (typeof TEACHING_LOCATIONS)[number];
export type SelfAssessment = (typeof SELF_ASSESSMENTS)[number];
```

`lib/types.ts`:

```ts
export type TeacherStatus = 'pending' | 'approved' | 'rejected';
export type InquiryStatus = 'new' | 'contacted' | 'placed';

// Matches columns of public.teachers_public exactly (see supabase migration).
export interface TeacherPublicRow {
  id: string;
  display_name: string;
  city: string;
  postal_code: string;
  country: string;
  radius_km: number;
  online_teaching: boolean;
  styles: string[];
  styles_other: string;
  equipment: string[];
  teaching_since: number | null;
  experience_years: number | null;
  educations: string;
  certifications: string;
  recent_trainings: string;
  self_assessment: string;
  quality_statement: string;
  offerings: string[];
  teaching_locations: string[];
  max_distance_km: number;
  photo_path: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

// Full row of public.teachers — admin only.
export interface TeacherRow extends Omit<TeacherPublicRow, 'display_name'> {
  updated_at: string;
  status: TeacherStatus;
  first_name: string;
  last_name: string;
  gender: string;
  email: string;
  phone: string;
  website_instagram: string;
  location_name: string;
}

export interface InquiryRow {
  id: string;
  created_at: string;
  teacher_id: string;
  studio_name: string;
  contact_name: string;
  email: string;
  phone: string;
  location: string;
  message: string;
  status: InquiryStatus;
}

export function photoUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/teacher-photos/${path}`;
}
```

- [ ] **Step 4: Write the three Supabase client factories**

`lib/supabase/public.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Anon client for reading teachers_public from server components. No cookies.
export function createSupabasePublicClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
```

`lib/supabase/service.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS. Server-only: never import from client code.
export function createSupabaseServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

`lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

// Cookie-bound client for the admin area (Supabase Auth sessions).
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore, proxy/actions refresh sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example lib/
git commit -m "feat: add deps, env scaffolding, Supabase clients, domain constants"
```

---

### Task 3: Validation, form parsing, filtering, geocoding (TDD)

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/validation.ts`, `lib/__tests__/validation.test.ts`
- Create: `lib/geocode.ts`, `lib/__tests__/geocode.test.ts`
- Create: `lib/filter.ts`, `lib/__tests__/filter.test.ts`
- Modify: `package.json` (add `"test": "vitest run"` script)

**Interfaces:**
- Consumes: constants from `lib/options.ts`, `TeacherPublicRow` from `lib/types.ts`
- Produces:
  - `teacherIntakeSchema` (zod), `inquirySchema` (zod), `parseIntakeFormData(fd: FormData): Record<string, unknown>`, `flattenZodErrors(error: ZodError): Record<string, string>` from `lib/validation.ts`
  - `geocode(postalCode: string, city: string, country: string): Promise<{ lat: number; lng: number } | null>` from `lib/geocode.ts`
  - `filterTeachers(teachers: TeacherPublicRow[], f: TeacherFilters): TeacherPublicRow[]` and `interface TeacherFilters { styles: string[]; equipment: string[]; offerings: string[]; onlineOnly: boolean; query: string }` from `lib/filter.ts`

- [ ] **Step 1: Vitest setup**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    include: ['lib/__tests__/**/*.test.ts'],
  },
});
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write failing validation tests**

`lib/__tests__/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  teacherIntakeSchema,
  inquirySchema,
  parseIntakeFormData,
  flattenZodErrors,
} from '@/lib/validation';

const validIntake = {
  first_name: 'Anna',
  last_name: 'Kramer',
  gender: 'female',
  email: 'anna@example.com',
  phone: '+49 170 1234567',
  website_instagram: '@annapilates',
  location_name: 'Studio Mitte',
  postal_code: '10115',
  city: 'Berlin',
  country: 'Deutschland',
  radius_km: 25,
  online_teaching: true,
  styles: ['classical', 'contemporary'],
  styles_other: '',
  equipment: ['mat', 'reformer'],
  teaching_since: 2018,
  experience_years: 8,
  educations: 'Sandra Leo Pilates Education, 500h',
  certifications: '',
  recent_trainings: '',
  self_assessment: 'very_experienced',
  quality_statement: 'Volle Kurse seit Jahren.',
  offerings: ['group_classes', 'personal_training'],
  teaching_locations: ['other_studio'],
  max_distance_km: 30,
  confirmed: true,
};

describe('teacherIntakeSchema', () => {
  it('accepts a valid intake', () => {
    const result = teacherIntakeSchema.safeParse(validIntake);
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields and unchecked confirmation', () => {
    const result = teacherIntakeSchema.safeParse({
      ...validIntake,
      first_name: '',
      confirmed: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = flattenZodErrors(result.error);
      expect(errors.first_name).toBeDefined();
      expect(errors.confirmed).toBeDefined();
    }
  });

  it('rejects invalid email and unknown style keys', () => {
    const result = teacherIntakeSchema.safeParse({
      ...validIntake,
      email: 'not-an-email',
      styles: ['jazzercise'],
    });
    expect(result.success).toBe(false);
  });

  it('requires at least one style, equipment, offering, location', () => {
    const result = teacherIntakeSchema.safeParse({
      ...validIntake,
      styles: [],
      equipment: [],
      offerings: [],
      teaching_locations: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = flattenZodErrors(result.error);
      expect(errors.styles).toBeDefined();
      expect(errors.equipment).toBeDefined();
      expect(errors.offerings).toBeDefined();
      expect(errors.teaching_locations).toBeDefined();
    }
  });
});

describe('parseIntakeFormData', () => {
  it('collects multi-select arrays, coerces booleans and numbers', () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(validIntake)) {
      if (Array.isArray(v)) v.forEach((item) => fd.append(k, item));
      else fd.set(k, String(v));
    }
    const parsed = parseIntakeFormData(fd);
    expect(parsed.styles).toEqual(['classical', 'contemporary']);
    expect(parsed.online_teaching).toBe(true);
    expect(parsed.confirmed).toBe(true);
    const result = teacherIntakeSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it('treats absent checkboxes as false and absent multi-selects as empty', () => {
    const fd = new FormData();
    fd.set('first_name', 'Anna');
    const parsed = parseIntakeFormData(fd);
    expect(parsed.online_teaching).toBe(false);
    expect(parsed.confirmed).toBe(false);
    expect(parsed.styles).toEqual([]);
  });
});

describe('inquirySchema', () => {
  it('accepts a valid inquiry', () => {
    const result = inquirySchema.safeParse({
      teacher_id: '3f1a3e1e-9d1e-4d0a-8c2b-1a2b3c4d5e6f',
      studio_name: 'Pilates Loft Köln',
      contact_name: 'Maria Beispiel',
      email: 'maria@loft.de',
      phone: '',
      location: 'Köln',
      message: 'Wir suchen ab September eine Trainerin für Reformer-Kurse.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing message/email', () => {
    const result = inquirySchema.safeParse({
      teacher_id: 'not-a-uuid',
      studio_name: '',
      contact_name: '',
      email: 'nope',
      message: '',
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '@/lib/validation'` (or equivalent).

- [ ] **Step 4: Implement `lib/validation.ts`**

```ts
import { z, type ZodError } from 'zod';
import {
  GENDERS,
  STYLES,
  EQUIPMENT,
  OFFERINGS,
  TEACHING_LOCATIONS,
  SELF_ASSESSMENTS,
} from '@/lib/options';

const CURRENT_YEAR = new Date().getFullYear();

export const teacherIntakeSchema = z.object({
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  gender: z.enum(GENDERS),
  email: z.email(),
  phone: z.string().trim().min(5),
  website_instagram: z.string().trim().max(300).default(''),
  location_name: z.string().trim().min(1),
  postal_code: z.string().trim().min(3).max(10),
  city: z.string().trim().min(1),
  country: z.string().trim().min(1).default('Deutschland'),
  radius_km: z.coerce.number().int().min(0).max(1000),
  online_teaching: z.boolean(),
  styles: z.array(z.enum(STYLES)).min(1),
  styles_other: z.string().trim().max(300).default(''),
  equipment: z.array(z.enum(EQUIPMENT)).min(1),
  teaching_since: z.coerce.number().int().min(1950).max(CURRENT_YEAR),
  experience_years: z.coerce.number().int().min(0).max(80),
  educations: z.string().trim().min(1).max(2000),
  certifications: z.string().trim().max(2000).default(''),
  recent_trainings: z.string().trim().max(2000).default(''),
  self_assessment: z.enum(SELF_ASSESSMENTS),
  quality_statement: z.string().trim().min(1).max(2000),
  offerings: z.array(z.enum(OFFERINGS)).min(1),
  teaching_locations: z.array(z.enum(TEACHING_LOCATIONS)).min(1),
  max_distance_km: z.coerce.number().int().min(0).max(1000),
  confirmed: z.literal(true),
});

export type TeacherIntake = z.infer<typeof teacherIntakeSchema>;

export const inquirySchema = z.object({
  teacher_id: z.uuid(),
  studio_name: z.string().trim().min(1).max(200),
  contact_name: z.string().trim().min(1).max(200),
  email: z.email(),
  phone: z.string().trim().max(50).default(''),
  location: z.string().trim().max(200).default(''),
  message: z.string().trim().min(1).max(5000),
});

export type Inquiry = z.infer<typeof inquirySchema>;

const MULTI_FIELDS = ['styles', 'equipment', 'offerings', 'teaching_locations'] as const;
const BOOL_FIELDS = ['online_teaching', 'confirmed'] as const;

export function parseIntakeFormData(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of teacherIntakeSchema.keyof().options) {
    if ((MULTI_FIELDS as readonly string[]).includes(key)) {
      out[key] = fd.getAll(key).map(String);
    } else if ((BOOL_FIELDS as readonly string[]).includes(key)) {
      const v = fd.get(key);
      out[key] = v === 'true' || v === 'on';
    } else {
      const v = fd.get(key);
      out[key] = v === null ? undefined : String(v);
    }
  }
  return out;
}

export function flattenZodErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
```

- [ ] **Step 5: Run validation tests to verify they pass**

```bash
npm test
```

Expected: validation tests PASS (geocode/filter tests don't exist yet).

- [ ] **Step 6: Write failing geocode test**

`lib/__tests__/geocode.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocode } from '@/lib/geocode';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      json: async () => response,
    }))
  );
}

describe('geocode', () => {
  it('returns lat/lng from the first Nominatim result', async () => {
    stubFetch([{ lat: '52.5321', lon: '13.3849' }]);
    const result = await geocode('10115', 'Berlin', 'Deutschland');
    expect(result).toEqual({ lat: 52.5321, lng: 13.3849 });
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(call[0])).toContain('nominatim.openstreetmap.org');
    expect(String(call[0])).toContain('postalcode=10115');
    expect(call[1].headers['User-Agent']).toContain('PilatesTeacherFinder');
  });

  it('returns null when Nominatim finds nothing', async () => {
    stubFetch([]);
    expect(await geocode('00000', 'Nirgendwo', 'Deutschland')).toBeNull();
  });

  it('returns null on HTTP error or network failure', async () => {
    stubFetch({}, false);
    expect(await geocode('10115', 'Berlin', 'Deutschland')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom'); }));
    expect(await geocode('10115', 'Berlin', 'Deutschland')).toBeNull();
  });
});
```

- [ ] **Step 7: Run to verify it fails, then implement `lib/geocode.ts`**

```bash
npm test
```

Expected: FAIL — `Cannot find module '@/lib/geocode'`.

`lib/geocode.ts`:

```ts
// City-level geocoding via Nominatim (OpenStreetMap). One request per intake
// submission — far below the 1 req/s rate limit. Failure is non-fatal: the
// teacher is saved without coordinates and flagged in the admin.
export async function geocode(
  postalCode: string,
  city: string,
  country: string
): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    postalcode: postalCode,
    city,
    country,
    format: 'jsonv2',
    limit: '1',
  });
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          'User-Agent': 'PilatesTeacherFinder/1.0 (leoharling@gmx.de)',
        },
      }
    );
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(results) || results.length === 0) return null;
    const lat = Number.parseFloat(results[0].lat);
    const lng = Number.parseFloat(results[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
```

- [ ] **Step 8: Write failing filter test, then implement**

`lib/__tests__/filter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { filterTeachers, type TeacherFilters } from '@/lib/filter';
import type { TeacherPublicRow } from '@/lib/types';

function teacher(partial: Partial<TeacherPublicRow>): TeacherPublicRow {
  return {
    id: 'x',
    display_name: 'Anna K.',
    city: 'Berlin',
    postal_code: '10115',
    country: 'Deutschland',
    radius_km: 25,
    online_teaching: false,
    styles: ['classical'],
    styles_other: '',
    equipment: ['mat'],
    teaching_since: 2018,
    experience_years: 8,
    educations: '',
    certifications: '',
    recent_trainings: '',
    self_assessment: 'advanced',
    quality_statement: '',
    offerings: ['group_classes'],
    teaching_locations: ['other_studio'],
    max_distance_km: 30,
    photo_path: null,
    lat: 52.5,
    lng: 13.4,
    created_at: '2026-07-06T00:00:00Z',
    ...partial,
  };
}

const none: TeacherFilters = { styles: [], equipment: [], offerings: [], onlineOnly: false, query: '' };

describe('filterTeachers', () => {
  const teachers = [
    teacher({ id: 'a', city: 'Berlin', styles: ['classical'], equipment: ['mat'] }),
    teacher({ id: 'b', city: 'München', postal_code: '80331', styles: ['contemporary'], equipment: ['reformer'], online_teaching: true }),
  ];

  it('returns all with empty filters', () => {
    expect(filterTeachers(teachers, none)).toHaveLength(2);
  });

  it('filters by style (any match)', () => {
    expect(filterTeachers(teachers, { ...none, styles: ['contemporary'] }).map((t) => t.id)).toEqual(['b']);
  });

  it('filters by equipment (any match)', () => {
    expect(filterTeachers(teachers, { ...none, equipment: ['mat'] }).map((t) => t.id)).toEqual(['a']);
  });

  it('filters by offering (any match)', () => {
    const withOfferings = [
      teacher({ id: 'a', offerings: ['group_classes'] }),
      teacher({ id: 'b', offerings: ['personal_training'] }),
    ];
    expect(filterTeachers(withOfferings, { ...none, offerings: ['personal_training'] }).map((t) => t.id)).toEqual(['b']);
  });

  it('filters online-only', () => {
    expect(filterTeachers(teachers, { ...none, onlineOnly: true }).map((t) => t.id)).toEqual(['b']);
  });

  it('matches query against city and postal code, case-insensitive', () => {
    expect(filterTeachers(teachers, { ...none, query: 'münch' }).map((t) => t.id)).toEqual(['b']);
    expect(filterTeachers(teachers, { ...none, query: '10115' }).map((t) => t.id)).toEqual(['a']);
  });
});
```

Run `npm test` — expected FAIL. Then implement `lib/filter.ts`:

```ts
import type { TeacherPublicRow } from '@/lib/types';

export interface TeacherFilters {
  styles: string[];
  equipment: string[];
  offerings: string[];
  onlineOnly: boolean;
  query: string;
}

export function filterTeachers(
  teachers: TeacherPublicRow[],
  f: TeacherFilters
): TeacherPublicRow[] {
  const q = f.query.trim().toLowerCase();
  return teachers.filter((t) => {
    if (f.styles.length > 0 && !f.styles.some((s) => t.styles.includes(s))) return false;
    if (f.equipment.length > 0 && !f.equipment.some((e) => t.equipment.includes(e))) return false;
    if (f.offerings.length > 0 && !f.offerings.some((o) => t.offerings.includes(o))) return false;
    if (f.onlineOnly && !t.online_teaching) return false;
    if (q && !t.city.toLowerCase().includes(q) && !t.postal_code.toLowerCase().includes(q)) return false;
    return true;
  });
}
```

- [ ] **Step 9: Run full test suite**

```bash
npm test
```

Expected: all tests PASS (3 files).

- [ ] **Step 10: Commit**

```bash
git add vitest.config.ts package.json lib/
git commit -m "feat: add validation, form parsing, filtering, and geocoding with tests"
```

---

### Task 4: i18n scaffold, layouts, brand styling, header

**Files:**
- Create: `i18n/routing.ts`, `i18n/request.ts`, `i18n/navigation.ts`, `proxy.ts`
- Create: `messages/de.json`, `messages/en.json`
- Create: `app/[locale]/layout.tsx`, `components/SiteHeader.tsx`, `components/LocaleSwitcher.tsx`
- Modify: `next.config.ts`, `app/layout.tsx`, `app/globals.css`
- Delete: `app/page.tsx` (replaced by `app/[locale]/page.tsx` in Task 6 — for now create a placeholder `app/[locale]/page.tsx`)

**Interfaces:**
- Produces:
  - `routing` (locales `['de','en']`, default `de`) from `i18n/routing.ts`
  - `Link`, `redirect`, `usePathname`, `useRouter` from `i18n/navigation.ts` — ALL later public-page links/redirects must use these, never `next/link` directly
  - Message namespaces: `common`, `nav`, `home`, `filters`, `profile`, `intake`, `inquiry`, `options` (see de.json below — en.json mirrors every key)
  - CSS utility classes via Tailwind theme tokens: `blush`, `blush-light`, `blush-deep`, `charcoal` (e.g. `bg-blush`, `text-charcoal`)

- [ ] **Step 1: next-intl wiring**

`i18n/routing.ts`:

```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['de', 'en'],
  defaultLocale: 'de',
});
```

`i18n/request.ts`:

```ts
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

`i18n/navigation.ts`:

```ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
```

`proxy.ts` (repo root — Next 16 name for middleware; admin and api are excluded so `/admin` stays unlocalized):

```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: '/((?!api|admin|_next|_vercel|.*\\..*).*)',
};
```

`next.config.ts`:

```ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {};

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
export default withNextIntl(nextConfig);
```

- [ ] **Step 2: Message catalogs**

`messages/de.json`:

```json
{
  "common": {
    "appName": "Pilates Teacher Finder",
    "byLine": "von Sandra Leo Pilates Education",
    "qualitySeal": "Geprüft von Sandra Leo",
    "online": "Online-Unterricht möglich",
    "yes": "Ja",
    "no": "Nein",
    "back": "Zurück",
    "submit": "Absenden",
    "sending": "Wird gesendet…",
    "requiredHint": "* Pflichtfeld",
    "error": "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    "km": "km"
  },
  "nav": {
    "map": "Trainer-Karte",
    "register": "Als Trainer bewerben"
  },
  "home": {
    "title": "Qualifizierte Pilates-Trainer in Ihrer Nähe",
    "subtitle": "Handverlesene Trainer, geprüft von Sandra Leo — für Studios in ganz Deutschland.",
    "teachersFound": "{count, plural, =0 {Keine Trainer gefunden} =1 {1 Trainer} other {# Trainer}}",
    "viewProfile": "Profil ansehen",
    "experienceYears": "{years} Jahre Erfahrung",
    "noResults": "Keine Trainer entsprechen den Filtern."
  },
  "filters": {
    "title": "Filter",
    "searchPlaceholder": "Stadt oder PLZ suchen…",
    "styles": "Pilates-Stil",
    "equipment": "Geräte",
    "offerings": "Angebot",
    "onlineOnly": "Nur Online-Unterricht",
    "reset": "Filter zurücksetzen"
  },
  "profile": {
    "aboutTitle": "Besondere Qualität",
    "detailsTitle": "Profil",
    "stylesTitle": "Pilates-Stile",
    "equipmentTitle": "Geräte",
    "offeringsTitle": "Unterrichtsangebot",
    "locationsTitle": "Unterrichtsorte",
    "experienceTitle": "Erfahrung",
    "teachingSince": "Unterrichtet seit {year}",
    "experienceYears": "{years} Jahre Erfahrung",
    "educations": "Ausbildungen",
    "certifications": "Zertifizierungen",
    "recentTrainings": "Fortbildungen der letzten 2 Jahre",
    "location": "Standort",
    "radius": "Unterricht im Umkreis von {km} km",
    "maxDistance": "Maximale Entfernung: {km} km",
    "requestButton": "Trainer anfragen",
    "notFound": "Trainer nicht gefunden."
  },
  "intake": {
    "title": "Trainerprofil einreichen",
    "subtitle": "Werden Sie Teil des Trainer-Pools von Sandra Leo Pilates Education. Nach Prüfung Ihres Profils melden wir uns bei Ihnen.",
    "sections": {
      "personal": "Persönliche Angaben",
      "location": "Standort",
      "styles": "Pilates-Stil",
      "equipment": "Geräte",
      "experience": "Erfahrung",
      "quality": "Qualitätsprofil",
      "offerings": "Unterrichtsangebot",
      "teachingLocations": "Unterrichtsorte",
      "photo": "Foto",
      "confirm": "Bestätigung"
    },
    "fields": {
      "first_name": "Vorname",
      "last_name": "Nachname",
      "gender": "Geschlecht",
      "email": "E-Mail",
      "phone": "Telefonnummer",
      "website_instagram": "Website / Instagram",
      "location_name": "Hauptstandort",
      "postal_code": "PLZ",
      "city": "Stadt",
      "country": "Land",
      "radius_km": "Unterricht möglich im Umkreis von (km)",
      "online_teaching": "Online-Unterricht möglich",
      "styles": "Ich unterrichte",
      "styles_other": "Sonstiges",
      "equipment": "Ich unterrichte an",
      "teaching_since": "Ich unterrichte Pilates seit (Jahr)",
      "experience_years": "Erfahrung in Jahren",
      "educations": "Abgeschlossene Pilates-Ausbildungen",
      "certifications": "Zertifizierungen",
      "recent_trainings": "Fortbildungen der letzten 2 Jahre",
      "self_assessment": "Eigene Einschätzung",
      "quality_statement": "Worin liegt Ihre besondere Qualität als Pilates-Trainer?",
      "offerings": "Angebot",
      "teaching_locations": "Ich unterrichte in",
      "max_distance_km": "Maximale Entfernung zum Unterrichten (km)",
      "photo": "Profilfoto",
      "confirmed": "Ich bestätige, dass alle Angaben korrekt sind und stimme der Speicherung meiner Daten zur Vermittlung zu."
    },
    "photoHint": "JPG oder PNG. Das Foto erscheint auf Ihrem öffentlichen Profil.",
    "errors": {
      "generic": "Bitte prüfen Sie die markierten Felder.",
      "field": "Bitte prüfen Sie dieses Feld.",
      "photoRequired": "Bitte laden Sie ein Foto hoch.",
      "photoTooLarge": "Das Foto ist zu groß (max. 8 MB).",
      "photoType": "Bitte nur JPG, PNG oder WebP hochladen."
    },
    "success": {
      "title": "Vielen Dank!",
      "body": "Ihr Profil ist eingegangen. Sandra Leo prüft Ihre Angaben persönlich und meldet sich bei Ihnen. Erst nach der Freigabe erscheint Ihr Profil auf der Karte."
    }
  },
  "inquiry": {
    "title": "Trainer anfragen",
    "subtitle": "Ihre Anfrage geht direkt an Sandra Leo, die den Kontakt persönlich herstellt.",
    "forTeacher": "Anfrage für {name} ({city})",
    "fields": {
      "studio_name": "Name des Studios",
      "contact_name": "Ansprechpartner",
      "email": "E-Mail",
      "phone": "Telefon (optional)",
      "location": "Ort des Studios",
      "message": "Ihre Nachricht"
    },
    "messagePlaceholder": "Was suchen Sie? (Kurstypen, Umfang, Zeitraum …)",
    "success": {
      "title": "Anfrage gesendet!",
      "body": "Vielen Dank! Sandra Leo meldet sich zeitnah bei Ihnen und stellt den Kontakt her."
    }
  },
  "options": {
    "genders": {
      "female": "Weiblich",
      "male": "Männlich",
      "diverse": "Divers"
    },
    "styles": {
      "classical": "Klassisch",
      "contemporary": "Contemporary",
      "rehab": "Rehabilitativ / therapeutisch",
      "athletic": "Sportlich / athletic",
      "prepostnatal": "Pre- / Postnatal",
      "seniors": "Senioren",
      "other": "Sonstiges"
    },
    "equipment": {
      "mat": "Matte",
      "reformer": "Reformer",
      "cadillac": "Cadillac / Trapeze Table",
      "chair": "Chair",
      "ladder_barrel": "Ladder Barrel",
      "spine_corrector": "Spine Corrector / Arc Barrel",
      "springboard": "Springboard",
      "tower": "Tower",
      "small_props": "Kleingeräte"
    },
    "offerings": {
      "personal_training": "Personal Training",
      "duet": "Duett",
      "small_groups": "Kleingruppen",
      "group_classes": "Gruppenkurse",
      "workshops": "Workshops",
      "teacher_training": "Teacher Training",
      "online": "Online"
    },
    "teachingLocations": {
      "own_studio": "Eigenes Studio",
      "other_studio": "Fremdstudio",
      "gym": "Fitnessstudio",
      "physio_practice": "Physiopraxis",
      "clients_home": "Beim Kunden zuhause",
      "online": "Online"
    },
    "selfAssessments": {
      "beginner": "Einsteiger",
      "advanced": "Fortgeschritten",
      "very_experienced": "Sehr erfahren",
      "expert": "Experte"
    }
  }
}
```

`messages/en.json` — mirror EVERY key with English copy:

```json
{
  "common": {
    "appName": "Pilates Teacher Finder",
    "byLine": "by Sandra Leo Pilates Education",
    "qualitySeal": "Vetted by Sandra Leo",
    "online": "Online classes available",
    "yes": "Yes",
    "no": "No",
    "back": "Back",
    "submit": "Submit",
    "sending": "Sending…",
    "requiredHint": "* Required field",
    "error": "Something went wrong. Please try again.",
    "km": "km"
  },
  "nav": {
    "map": "Teacher map",
    "register": "Apply as a teacher"
  },
  "home": {
    "title": "Qualified pilates teachers near you",
    "subtitle": "Hand-picked teachers, vetted by Sandra Leo — for studios across Germany.",
    "teachersFound": "{count, plural, =0 {No teachers found} =1 {1 teacher} other {# teachers}}",
    "viewProfile": "View profile",
    "experienceYears": "{years} years of experience",
    "noResults": "No teachers match the current filters."
  },
  "filters": {
    "title": "Filters",
    "searchPlaceholder": "Search city or postal code…",
    "styles": "Pilates style",
    "equipment": "Equipment",
    "offerings": "Offerings",
    "onlineOnly": "Online classes only",
    "reset": "Reset filters"
  },
  "profile": {
    "aboutTitle": "What sets them apart",
    "detailsTitle": "Profile",
    "stylesTitle": "Pilates styles",
    "equipmentTitle": "Equipment",
    "offeringsTitle": "Class offerings",
    "locationsTitle": "Teaching locations",
    "experienceTitle": "Experience",
    "teachingSince": "Teaching since {year}",
    "experienceYears": "{years} years of experience",
    "educations": "Completed trainings",
    "certifications": "Certifications",
    "recentTrainings": "Continuing education (last 2 years)",
    "location": "Location",
    "radius": "Teaches within {km} km",
    "maxDistance": "Maximum distance: {km} km",
    "requestButton": "Request this teacher",
    "notFound": "Teacher not found."
  },
  "intake": {
    "title": "Submit your teacher profile",
    "subtitle": "Join the teacher pool of Sandra Leo Pilates Education. We review every profile personally and get back to you.",
    "sections": {
      "personal": "Personal details",
      "location": "Location",
      "styles": "Pilates style",
      "equipment": "Equipment",
      "experience": "Experience",
      "quality": "Quality profile",
      "offerings": "Class offerings",
      "teachingLocations": "Teaching locations",
      "photo": "Photo",
      "confirm": "Confirmation"
    },
    "fields": {
      "first_name": "First name",
      "last_name": "Last name",
      "gender": "Gender",
      "email": "Email",
      "phone": "Phone number",
      "website_instagram": "Website / Instagram",
      "location_name": "Main location",
      "postal_code": "Postal code",
      "city": "City",
      "country": "Country",
      "radius_km": "Willing to teach within (km)",
      "online_teaching": "Online classes possible",
      "styles": "I teach",
      "styles_other": "Other",
      "equipment": "I teach on",
      "teaching_since": "Teaching pilates since (year)",
      "experience_years": "Years of experience",
      "educations": "Completed pilates trainings",
      "certifications": "Certifications",
      "recent_trainings": "Continuing education (last 2 years)",
      "self_assessment": "Self-assessment",
      "quality_statement": "What sets you apart as a pilates teacher?",
      "offerings": "Offerings",
      "teaching_locations": "I teach in",
      "max_distance_km": "Maximum distance for teaching (km)",
      "photo": "Profile photo",
      "confirmed": "I confirm that all information is correct and consent to my data being stored for placement purposes."
    },
    "photoHint": "JPG or PNG. The photo appears on your public profile.",
    "errors": {
      "generic": "Please check the highlighted fields.",
      "field": "Please check this field.",
      "photoRequired": "Please upload a photo.",
      "photoTooLarge": "The photo is too large (max. 8 MB).",
      "photoType": "Please upload JPG, PNG or WebP only."
    },
    "success": {
      "title": "Thank you!",
      "body": "Your profile has been received. Sandra Leo reviews every application personally and will get back to you. Your profile appears on the map only after approval."
    }
  },
  "inquiry": {
    "title": "Request this teacher",
    "subtitle": "Your inquiry goes directly to Sandra Leo, who makes the introduction personally.",
    "forTeacher": "Inquiry for {name} ({city})",
    "fields": {
      "studio_name": "Studio name",
      "contact_name": "Contact person",
      "email": "Email",
      "phone": "Phone (optional)",
      "location": "Studio location",
      "message": "Your message"
    },
    "messagePlaceholder": "What are you looking for? (class types, hours, timeframe …)",
    "success": {
      "title": "Inquiry sent!",
      "body": "Thank you! Sandra Leo will get back to you shortly and make the introduction."
    }
  },
  "options": {
    "genders": {
      "female": "Female",
      "male": "Male",
      "diverse": "Non-binary"
    },
    "styles": {
      "classical": "Classical",
      "contemporary": "Contemporary",
      "rehab": "Rehabilitative / therapeutic",
      "athletic": "Athletic",
      "prepostnatal": "Pre-/postnatal",
      "seniors": "Seniors",
      "other": "Other"
    },
    "equipment": {
      "mat": "Mat",
      "reformer": "Reformer",
      "cadillac": "Cadillac / trapeze table",
      "chair": "Chair",
      "ladder_barrel": "Ladder barrel",
      "spine_corrector": "Spine corrector / arc barrel",
      "springboard": "Springboard",
      "tower": "Tower",
      "small_props": "Small props"
    },
    "offerings": {
      "personal_training": "Personal training",
      "duet": "Duet",
      "small_groups": "Small groups",
      "group_classes": "Group classes",
      "workshops": "Workshops",
      "teacher_training": "Teacher training",
      "online": "Online"
    },
    "teachingLocations": {
      "own_studio": "Own studio",
      "other_studio": "Partner studio",
      "gym": "Gym",
      "physio_practice": "Physiotherapy practice",
      "clients_home": "Clients' homes",
      "online": "Online"
    },
    "selfAssessments": {
      "beginner": "Beginner",
      "advanced": "Advanced",
      "very_experienced": "Very experienced",
      "expert": "Expert"
    }
  }
}
```

- [ ] **Step 3: Brand styling**

Replace `app/globals.css` with:

```css
@import "tailwindcss";

@theme {
  --color-blush: #f5c6d8;
  --color-blush-light: #fbe9f1;
  --color-blush-deep: #e8a8c4;
  --color-charcoal: #3a3a3a;
  --color-charcoal-soft: #6b6b6b;
}

body {
  background: #ffffff;
  color: var(--color-charcoal);
}

.heading-brand {
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 600;
}
```

- [ ] **Step 4: Layouts and header**

Replace `app/layout.tsx` (root — html/body only; lang is refined per subtree):

```tsx
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Pilates Teacher Finder — Sandra Leo Pilates Education',
  description:
    'Qualifizierte Pilates-Trainer in ganz Deutschland, geprüft von Sandra Leo.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={geist.className}>{children}</body>
    </html>
  );
}
```

Delete `app/page.tsx`.

`app/[locale]/layout.tsx`:

```tsx
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import SiteHeader from '@/components/SiteHeader';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-blush-light px-6 py-4 text-center text-xs text-charcoal-soft">
          © Sandra Leo Pilates Education · sandraleopilates.com
        </footer>
      </div>
    </NextIntlClientProvider>
  );
}
```

`components/SiteHeader.tsx`:

```tsx
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import LocaleSwitcher from '@/components/LocaleSwitcher';

export default function SiteHeader() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  return (
    <header className="flex items-center justify-between gap-4 border-b border-blush-light bg-white px-6 py-3">
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/images/image-1200x924.png"
          alt="Sandra Leo Pilates Education"
          width={72}
          height={55}
          priority
        />
        <span className="heading-brand hidden text-sm text-charcoal sm:block">
          {tc('appName')}
        </span>
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        <Link href="/" className="hover:text-blush-deep">
          {t('map')}
        </Link>
        <Link
          href="/registrieren"
          className="rounded-full bg-blush px-4 py-2 font-medium text-charcoal hover:bg-blush-deep"
        >
          {t('register')}
        </Link>
        <LocaleSwitcher />
      </nav>
    </header>
  );
}
```

`components/LocaleSwitcher.tsx`:

```tsx
'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const other = locale === 'de' ? 'en' : 'de';
  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: other })}
      className="rounded border border-blush px-2 py-1 text-xs uppercase tracking-wider text-charcoal-soft hover:bg-blush-light"
      aria-label={other === 'de' ? 'Auf Deutsch wechseln' : 'Switch to English'}
    >
      {other}
    </button>
  );
}
```

Placeholder `app/[locale]/page.tsx` (replaced in Task 6):

```tsx
import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('home');
  return (
    <div className="px-6 py-16 text-center">
      <h1 className="heading-brand text-2xl">{t('title')}</h1>
      <p className="mt-3 text-charcoal-soft">{t('subtitle')}</p>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npm run build
```

Expected: build succeeds, routes `/​[locale]` present. Then:

```bash
npm run dev &
sleep 5
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/
curl -s http://localhost:3000/de | grep -o "Qualifizierte Pilates-Trainer" | head -1
curl -s http://localhost:3000/en | grep -o "Qualified pilates teachers" | head -1
kill %1
```

Expected: `/` redirects to `/de`; both locale pages render their heading.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts proxy.ts i18n/ messages/ app/ components/
git rm --cached app/page.tsx 2>/dev/null; true
git commit -m "feat: add DE/EN i18n scaffold, brand layout and header"
```

---

### Task 5: Intake server action (photo upload + geocode + insert)

**Files:**
- Create: `app/actions/teachers.ts`
- Create: `lib/image.ts`

**Interfaces:**
- Consumes: `teacherIntakeSchema`, `parseIntakeFormData`, `flattenZodErrors` (Task 3), `geocode` (Task 3), `createSupabaseServiceClient` (Task 2)
- Produces:
  - `submitTeacherApplication(formData: FormData): Promise<IntakeResult>` where `type IntakeResult = { ok: true } | { ok: false; errors: Record<string, string> }` — error keys are field names plus optional `photo` and `_form`
  - `downscaleImage(file: File, maxDim?: number): Promise<Blob>` from `lib/image.ts` (client-side canvas downscale)

- [ ] **Step 1: Client-side image downscale helper**

`lib/image.ts`:

```ts
// Downscale an image in the browser before upload. Returns a JPEG blob.
export async function downscaleImage(file: File, maxDim = 1200): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 2 * 1024 * 1024) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.85
    );
  });
}
```

- [ ] **Step 2: Server action**

`app/actions/teachers.ts`:

```ts
'use server';

import { randomUUID } from 'node:crypto';
import {
  teacherIntakeSchema,
  parseIntakeFormData,
  flattenZodErrors,
} from '@/lib/validation';
import { geocode } from '@/lib/geocode';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export type IntakeResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function submitTeacherApplication(
  formData: FormData
): Promise<IntakeResult> {
  const parsed = teacherIntakeSchema.safeParse(parseIntakeFormData(formData));
  if (!parsed.success) {
    return { ok: false, errors: flattenZodErrors(parsed.error) };
  }

  const photo = formData.get('photo');
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, errors: { photo: 'photoRequired' } };
  }
  if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) {
    return { ok: false, errors: { photo: 'photoType' } };
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return { ok: false, errors: { photo: 'photoTooLarge' } };
  }

  const supabase = createSupabaseServiceClient();

  const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
  const photoPath = `${randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('teacher-photos')
    .upload(photoPath, photo, { contentType: photo.type });
  if (uploadError) {
    console.error('photo upload failed', uploadError);
    return { ok: false, errors: { _form: 'generic' } };
  }

  const { confirmed: _confirmed, ...teacher } = parsed.data;
  const coords = await geocode(teacher.postal_code, teacher.city, teacher.country);

  const { error: insertError } = await supabase.from('teachers').insert({
    ...teacher,
    photo_path: photoPath,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    status: 'pending',
  });
  if (insertError) {
    console.error('teacher insert failed', insertError);
    return { ok: false, errors: { _form: 'generic' } };
  }

  return { ok: true };
}
```

- [ ] **Step 3: Verify build + tests**

```bash
npm run build && npm test
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add app/actions/teachers.ts lib/image.ts
git commit -m "feat: add teacher intake server action with photo upload and geocoding"
```

---

### Task 6: Intake form UI (`/registrieren`)

**Files:**
- Create: `app/[locale]/registrieren/page.tsx`
- Create: `components/IntakeForm.tsx`
- Create: `components/forms.tsx` (shared small form primitives)

**Interfaces:**
- Consumes: `submitTeacherApplication`, `IntakeResult` (Task 5), `downscaleImage` (Task 5), options constants (Task 2), messages `intake.*`, `options.*`, `common.*` (Task 4)
- Produces: shared form primitives used again by the inquiry form (Task 9): `TextField`, `TextArea`, `CheckboxGroup`, `RadioGroup`, `SectionHeading`, `ErrorText` from `components/forms.tsx` — exact props in code below.

- [ ] **Step 1: Shared form primitives**

`components/forms.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="heading-brand mt-10 mb-4 border-b border-blush-light pb-2 text-sm text-charcoal">
      {children}
    </h2>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-red-600">{children}</p>;
}

const inputClass =
  'w-full rounded-md border border-blush px-3 py-2 text-sm focus:border-blush-deep focus:outline-none bg-white';

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
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
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
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
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
      <legend className="mb-2 text-sm font-medium">{label} *</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} value={o.value} className="accent-blush-deep" />
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
      <legend className="mb-2 text-sm font-medium">{label} *</legend>
      <div className="flex flex-wrap gap-4">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input type="radio" name={name} value={o.value} className="accent-blush-deep" />
            {o.label}
          </label>
        ))}
      </div>
      <ErrorText>{error}</ErrorText>
    </fieldset>
  );
}
```

- [ ] **Step 2: Intake form component**

`components/IntakeForm.tsx`:

```tsx
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
      const result: IntakeResult = await submitTeacherApplication(fd);
      if (result.ok) {
        setSubmitted(true);
        window.scrollTo({ top: 0 });
      } else {
        setErrors(result.errors);
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
```

- [ ] **Step 3: Page**

`app/[locale]/registrieren/page.tsx`:

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';
import IntakeForm from '@/components/IntakeForm';

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('intake');
  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="heading-brand text-2xl">{t('title')}</h1>
        <p className="mt-3 text-sm text-charcoal-soft">{t('subtitle')}</p>
      </div>
      <div className="mt-8">
        <IntakeForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify end-to-end against real Supabase**

```bash
npm run build
npm run dev &
sleep 5
curl -s http://localhost:3000/de/registrieren | grep -o "Trainerprofil einreichen" | head -1
```

Then submit a real test application with a small test image via curl against the dev server is impractical for server actions — instead verify manually or via Playwright MCP if available: fill the form at `http://localhost:3000/de/registrieren` with test data ("Test Trainer"), submit, then check:

```bash
supabase db query "select first_name, status, lat, lng, photo_path from teachers order by created_at desc limit 1" 2>/dev/null || echo "verify via Supabase dashboard: teachers table has a pending 'Test' row with lat/lng and photo_path"
kill %1
```

Expected: one `pending` row with non-null `lat`, `lng`, `photo_path`. Keep the test row for now — it's used to verify the map (Task 7) and admin (Task 11); it gets deleted in Task 12.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/registrieren components/
git commit -m "feat: add teacher intake form with photo upload"
```

---

### Task 7: Public map page (`/`)

**Files:**
- Create: `lib/queries.ts`
- Create: `components/MapExplorer.tsx`, `components/TeacherMap.tsx`, `components/TeacherCard.tsx`
- Modify: `app/[locale]/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `createSupabasePublicClient` (Task 2), `TeacherPublicRow`, `photoUrl` (Task 2), `filterTeachers`, `TeacherFilters` (Task 3), messages `home.*`, `filters.*`, `common.*`, `options.*`
- Produces:
  - `getApprovedTeachers(): Promise<TeacherPublicRow[]>` and `getTeacherById(id: string): Promise<TeacherPublicRow | null>` from `lib/queries.ts`
  - `<TeacherMap teachers={TeacherPublicRow[]} selectedId={string | null} onSelect={(id: string | null) => void} />` — imperative Leaflet, client-only
  - `<TeacherCard teacher={TeacherPublicRow} />` — used on map overlay and reusable

- [ ] **Step 1: Queries**

`lib/queries.ts`:

```ts
import { createSupabasePublicClient } from '@/lib/supabase/public';
import type { TeacherPublicRow } from '@/lib/types';

export async function getApprovedTeachers(): Promise<TeacherPublicRow[]> {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from('teachers_public')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('getApprovedTeachers failed', error);
    return [];
  }
  return (data ?? []) as TeacherPublicRow[];
}

export async function getTeacherById(
  id: string
): Promise<TeacherPublicRow | null> {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from('teachers_public')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('getTeacherById failed', error);
    return null;
  }
  return (data as TeacherPublicRow) ?? null;
}
```

- [ ] **Step 2: Imperative Leaflet map component**

`components/TeacherMap.tsx` (no react-leaflet — plain Leaflet + markercluster in a client component; pink `divIcon` markers avoid Leaflet's bundler-broken default icon assets):

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { TeacherPublicRow } from '@/lib/types';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const GERMANY_CENTER: [number, number] = [51.1657, 10.4515];

export default function TeacherMap({
  teachers,
  selectedId,
  onSelect,
}: {
  teachers: TeacherPublicRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Leaflet types via any-free dynamic import; L is loaded once on mount.
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const clusterRef = useRef<import('leaflet').MarkerClusterGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet.markercluster');
      if (disposed || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(
        GERMANY_CENTER,
        6
      );
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      mapRef.current = map;
      clusterRef.current = L.markerClusterGroup();
      map.addLayer(clusterRef.current);
      map.on('click', () => onSelectRef.current(null));
      renderMarkers(L);
    })();

    function renderMarkers(L: typeof import('leaflet')) {
      const cluster = clusterRef.current;
      if (!cluster) return;
      cluster.clearLayers();
      for (const t of teachers) {
        if (t.lat === null || t.lng === null) continue;
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#e8a8c4;border:2px solid #3a3a3a22;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });
        const marker = L.marker([t.lat, t.lng], { icon, title: t.display_name });
        marker.on('click', () => onSelectRef.current(t.id));
        cluster.addLayer(marker);
      }
    }

    // Re-render markers when teachers change and map already exists.
    if (mapRef.current) {
      import('leaflet').then((mod) => renderMarkers(mod.default));
    }

    return () => {
      disposed = true;
    };
  }, [teachers]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  // selectedId is accepted for future use (e.g. highlighting); markers drive selection.
  void selectedId;

  return <div ref={containerRef} className="h-full w-full" />;
}
```

Note for the implementer: `leaflet.markercluster` augments the `L` namespace; the `@types/leaflet.markercluster` package provides `L.markerClusterGroup()` and the `MarkerClusterGroup` type. If TypeScript complains about the `import('leaflet').MarkerClusterGroup` ref type, use `ReturnType<typeof import('leaflet').markerClusterGroup>` or `any` for the cluster ref — do not fight the types.

- [ ] **Step 3: Teacher card + explorer**

`components/TeacherCard.tsx`:

```tsx
'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { TeacherPublicRow } from '@/lib/types';
import { photoUrl } from '@/lib/types';

export default function TeacherCard({ teacher }: { teacher: TeacherPublicRow }) {
  const t = useTranslations('home');
  const tc = useTranslations('common');
  const to = useTranslations('options');
  const src = photoUrl(teacher.photo_path);
  return (
    <div className="flex gap-4 rounded-lg border border-blush-light bg-white p-4 shadow-sm">
      {src ? (
        <Image
          src={src}
          alt={teacher.display_name}
          width={72}
          height={72}
          className="h-18 w-18 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-18 w-18 items-center justify-center rounded-full bg-blush-light text-xl">
          {teacher.display_name.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{teacher.display_name}</p>
        <p className="text-sm text-charcoal-soft">
          {teacher.city}
          {teacher.radius_km > 0 ? ` · ${teacher.radius_km} ${tc('km')}` : ''}
        </p>
        <p className="mt-1 truncate text-xs text-charcoal-soft">
          {teacher.styles.map((s) => to(`styles.${s}`)).join(' · ')}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blush-light px-2 py-0.5 text-[11px]">
            {tc('qualitySeal')}
          </span>
          {teacher.online_teaching && (
            <span className="rounded-full bg-blush-light px-2 py-0.5 text-[11px]">
              {tc('online')}
            </span>
          )}
          {teacher.experience_years !== null && (
            <span className="text-[11px] text-charcoal-soft">
              {t('experienceYears', { years: teacher.experience_years })}
            </span>
          )}
        </div>
        <Link
          href={`/trainer/${teacher.id}`}
          className="mt-2 inline-block text-sm font-medium text-blush-deep hover:underline"
        >
          {t('viewProfile')} →
        </Link>
      </div>
    </div>
  );
}
```

`components/MapExplorer.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import type { TeacherPublicRow } from '@/lib/types';
import { filterTeachers, type TeacherFilters } from '@/lib/filter';
import { STYLES, EQUIPMENT, OFFERINGS } from '@/lib/options';
import TeacherCard from '@/components/TeacherCard';

const TeacherMap = dynamic(() => import('@/components/TeacherMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-blush-light" />,
});

const EMPTY: TeacherFilters = { styles: [], equipment: [], offerings: [], onlineOnly: false, query: '' };

export default function MapExplorer({ teachers }: { teachers: TeacherPublicRow[] }) {
  const t = useTranslations('home');
  const tf = useTranslations('filters');
  const to = useTranslations('options');
  const [filters, setFilters] = useState<TeacherFilters>(EMPTY);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => filterTeachers(teachers, filters), [teachers, filters]);
  const selected = filtered.find((x) => x.id === selectedId) ?? null;

  function toggle(key: 'styles' | 'equipment' | 'offerings', value: string) {
    setFilters((f) => {
      const list = f[key].includes(value)
        ? f[key].filter((v) => v !== value)
        : [...f[key], value];
      return { ...f, [key]: list };
    });
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col lg:flex-row">
      <aside className="w-full shrink-0 space-y-5 overflow-y-auto border-b border-blush-light p-5 lg:w-80 lg:border-r lg:border-b-0">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          placeholder={tf('searchPlaceholder')}
          className="w-full rounded-md border border-blush px-3 py-2 text-sm focus:border-blush-deep focus:outline-none"
        />
        <div>
          <p className="heading-brand mb-2 text-xs">{tf('styles')}</p>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle('styles', s)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  filters.styles.includes(s)
                    ? 'border-blush-deep bg-blush text-charcoal'
                    : 'border-blush-light text-charcoal-soft hover:border-blush'
                }`}
              >
                {to(`styles.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="heading-brand mb-2 text-xs">{tf('equipment')}</p>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle('equipment', s)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  filters.equipment.includes(s)
                    ? 'border-blush-deep bg-blush text-charcoal'
                    : 'border-blush-light text-charcoal-soft hover:border-blush'
                }`}
              >
                {to(`equipment.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="heading-brand mb-2 text-xs">{tf('offerings')}</p>
          <div className="flex flex-wrap gap-1.5">
            {OFFERINGS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle('offerings', s)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  filters.offerings.includes(s)
                    ? 'border-blush-deep bg-blush text-charcoal'
                    : 'border-blush-light text-charcoal-soft hover:border-blush'
                }`}
              >
                {to(`offerings.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.onlineOnly}
            onChange={(e) => setFilters((f) => ({ ...f, onlineOnly: e.target.checked }))}
            className="accent-blush-deep"
          />
          {tf('onlineOnly')}
        </label>
        <div className="flex items-center justify-between">
          <p className="text-sm text-charcoal-soft">
            {t('teachersFound', { count: filtered.length })}
          </p>
          <button
            type="button"
            onClick={() => setFilters(EMPTY)}
            className="text-xs text-blush-deep hover:underline"
          >
            {tf('reset')}
          </button>
        </div>
        <div className="hidden space-y-3 lg:block">
          {filtered.length === 0 && (
            <p className="text-sm text-charcoal-soft">{t('noResults')}</p>
          )}
          {filtered.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} />
          ))}
        </div>
      </aside>
      <div className="relative min-h-[420px] flex-1">
        <TeacherMap teachers={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        {selected && (
          <div className="absolute right-4 bottom-4 left-4 z-[1000] mx-auto max-w-md">
            <TeacherCard teacher={selected} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Home page**

Replace `app/[locale]/page.tsx`:

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getApprovedTeachers } from '@/lib/queries';
import MapExplorer from '@/components/MapExplorer';

export const revalidate = 60;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const teachers = await getApprovedTeachers();
  return (
    <div>
      <div className="border-b border-blush-light px-6 py-6 text-center">
        <h1 className="heading-brand text-xl sm:text-2xl">{t('title')}</h1>
        <p className="mt-2 text-sm text-charcoal-soft">{t('subtitle')}</p>
      </div>
      <MapExplorer teachers={teachers} />
    </div>
  );
}
```

Also add the Supabase storage host to `next.config.ts` image config (needed for teacher photos via `next/image`):

```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'olgrifbkczkrqpsuxych.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};
```

- [ ] **Step 5: Verify**

The Task 6 test teacher is still `pending`, so the map should be empty. Temporarily approve it to see a marker:

```bash
supabase db query "update teachers set status='approved' where first_name='Test'" 2>/dev/null || echo "approve the Test row via Supabase dashboard"
npm run build && npm run dev &
sleep 5
curl -s http://localhost:3000/de | grep -c "MapExplorer\|leaflet" || true
kill %1
```

Then verify visually (Playwright MCP or manually): `http://localhost:3000/de` shows the map with one pink marker at the test teacher's city; clicking it opens the card; filters narrow the list; `/en` shows English copy.

- [ ] **Step 6: Commit**

```bash
git add lib/queries.ts components/ app/
git commit -m "feat: add public teacher map with filters and cards"
```

---

### Task 8: Public profile page (`/trainer/[id]`)

**Files:**
- Create: `app/[locale]/trainer/[id]/page.tsx`

**Interfaces:**
- Consumes: `getTeacherById` (Task 7), `photoUrl` (Task 2), messages `profile.*`, `common.*`, `options.*`, `Link` from `i18n/navigation`

- [ ] **Step 1: Profile page**

`app/[locale]/trainer/[id]/page.tsx`:

```tsx
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getTeacherById } from '@/lib/queries';
import { photoUrl } from '@/lib/types';

export const revalidate = 60;

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const teacher = await getTeacherById(id);
  if (!teacher) notFound();

  const t = await getTranslations('profile');
  const tc = await getTranslations('common');
  const to = await getTranslations('options');
  const src = photoUrl(teacher.photo_path);

  const chipList = (keys: string[], ns: string) => (
    <div className="flex flex-wrap gap-2">
      {keys.map((k) => (
        <span key={k} className="rounded-full bg-blush-light px-3 py-1 text-sm">
          {to(`${ns}.${k}`)}
        </span>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {src ? (
          <Image
            src={src}
            alt={teacher.display_name}
            width={160}
            height={160}
            className="h-40 w-40 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-full bg-blush-light text-5xl">
            {teacher.display_name.charAt(0)}
          </div>
        )}
        <div className="text-center sm:text-left">
          <h1 className="heading-brand text-2xl">{teacher.display_name}</h1>
          <p className="mt-1 text-charcoal-soft">
            {teacher.city}, {teacher.country}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <span className="rounded-full bg-blush px-3 py-1 text-sm font-medium">
              {tc('qualitySeal')}
            </span>
            <span className="rounded-full bg-blush-light px-3 py-1 text-sm">
              {to(`selfAssessments.${teacher.self_assessment}`)}
            </span>
            {teacher.online_teaching && (
              <span className="rounded-full bg-blush-light px-3 py-1 text-sm">
                {tc('online')}
              </span>
            )}
          </div>
          <Link
            href={`/anfrage/${teacher.id}`}
            className="mt-5 inline-block rounded-full bg-blush px-6 py-3 font-medium text-charcoal hover:bg-blush-deep"
          >
            {t('requestButton')}
          </Link>
        </div>
      </div>

      {teacher.quality_statement && (
        <section className="mt-10">
          <h2 className="heading-brand mb-3 text-sm">{t('aboutTitle')}</h2>
          <p className="leading-relaxed whitespace-pre-line">{teacher.quality_statement}</p>
        </section>
      )}

      <section className="mt-10">
        <h2 className="heading-brand mb-3 text-sm">{t('experienceTitle')}</h2>
        <ul className="space-y-2 text-sm">
          {teacher.teaching_since !== null && (
            <li>{t('teachingSince', { year: teacher.teaching_since })}</li>
          )}
          {teacher.experience_years !== null && (
            <li>{t('experienceYears', { years: teacher.experience_years })}</li>
          )}
        </ul>
        {teacher.educations && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-medium">{t('educations')}</h3>
            <p className="text-sm whitespace-pre-line text-charcoal-soft">{teacher.educations}</p>
          </div>
        )}
        {teacher.certifications && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-medium">{t('certifications')}</h3>
            <p className="text-sm whitespace-pre-line text-charcoal-soft">{teacher.certifications}</p>
          </div>
        )}
        {teacher.recent_trainings && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-medium">{t('recentTrainings')}</h3>
            <p className="text-sm whitespace-pre-line text-charcoal-soft">{teacher.recent_trainings}</p>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="heading-brand mb-3 text-sm">{t('stylesTitle')}</h2>
        {chipList(teacher.styles, 'styles')}
        {teacher.styles_other && (
          <p className="mt-2 text-sm text-charcoal-soft">{teacher.styles_other}</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="heading-brand mb-3 text-sm">{t('equipmentTitle')}</h2>
        {chipList(teacher.equipment, 'equipment')}
      </section>

      <section className="mt-10">
        <h2 className="heading-brand mb-3 text-sm">{t('offeringsTitle')}</h2>
        {chipList(teacher.offerings, 'offerings')}
      </section>

      <section className="mt-10">
        <h2 className="heading-brand mb-3 text-sm">{t('locationsTitle')}</h2>
        {chipList(teacher.teaching_locations, 'teachingLocations')}
        <ul className="mt-3 space-y-1 text-sm text-charcoal-soft">
          <li>
            {t('location')}: {teacher.city}, {teacher.postal_code}
          </li>
          {teacher.radius_km > 0 && <li>{t('radius', { km: teacher.radius_km })}</li>}
          {teacher.max_distance_km > 0 && (
            <li>{t('maxDistance', { km: teacher.max_distance_km })}</li>
          )}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify — including the privacy constraint**

```bash
npm run build && npm run dev &
sleep 5
TEACHER_ID=$(curl -s http://localhost:3000/de | grep -o 'trainer/[a-f0-9-]*' | head -1 | cut -d/ -f2)
curl -s "http://localhost:3000/de/trainer/$TEACHER_ID" > /tmp/profile.html
grep -c "Trainer anfragen" /tmp/profile.html
# CRITICAL privacy check — the test teacher's email/phone/last name must NOT appear:
grep -ci "test@example\|@gmx\|Nachname-des-Tests" /tmp/profile.html || echo "PRIVACY OK"
kill %1
```

Expected: profile renders with request button; privacy grep finds nothing. Also check an unknown id returns 404: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/de/trainer/00000000-0000-0000-0000-000000000000` → `404`.

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "feat: add public teacher profile page"
```

---

### Task 9: Studio inquiry flow (`/anfrage/[teacherId]`) + email

**Files:**
- Create: `app/actions/inquiries.ts`, `lib/email.ts`
- Create: `app/[locale]/anfrage/[teacherId]/page.tsx`, `components/InquiryForm.tsx`

**Interfaces:**
- Consumes: `inquirySchema`, `flattenZodErrors` (Task 3), `createSupabaseServiceClient` (Task 2), `getTeacherById` (Task 7), form primitives (Task 6), messages `inquiry.*`
- Produces: `submitInquiry(formData: FormData): Promise<InquiryResult>` with `type InquiryResult = { ok: true } | { ok: false; errors: Record<string, string> }`; `sendInquiryNotification(args: { teacherDisplayName: string; studioName: string; contactName: string; email: string; phone: string; location: string; message: string }): Promise<void>` from `lib/email.ts`

- [ ] **Step 1: Email helper**

`lib/email.ts`:

```ts
import { Resend } from 'resend';

// Sends Sandra a notification for each new inquiry. No-op when RESEND_API_KEY
// or INQUIRY_NOTIFY_EMAIL is unset — inquiries are still stored in Supabase.
export async function sendInquiryNotification(args: {
  teacherDisplayName: string;
  studioName: string;
  contactName: string;
  email: string;
  phone: string;
  location: string;
  message: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_NOTIFY_EMAIL;
  if (!apiKey || !to) {
    console.log('email skipped (RESEND_API_KEY/INQUIRY_NOTIFY_EMAIL unset)');
    return;
  }
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: 'Pilates Teacher Finder <onboarding@resend.dev>',
      to,
      subject: `Neue Studio-Anfrage für ${args.teacherDisplayName}`,
      text: [
        `Neue Anfrage über den Pilates Teacher Finder:`,
        ``,
        `Trainer: ${args.teacherDisplayName}`,
        `Studio: ${args.studioName}${args.location ? ` (${args.location})` : ''}`,
        `Kontakt: ${args.contactName}`,
        `E-Mail: ${args.email}`,
        args.phone ? `Telefon: ${args.phone}` : '',
        ``,
        `Nachricht:`,
        args.message,
        ``,
        `Alle Anfragen: /admin/anfragen`,
      ]
        .filter((line) => line !== '')
        .join('\n'),
    });
  } catch (err) {
    console.error('inquiry email failed (inquiry is stored anyway)', err);
  }
}
```

- [ ] **Step 2: Server action**

`app/actions/inquiries.ts`:

```ts
'use server';

import { inquirySchema, flattenZodErrors } from '@/lib/validation';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { sendInquiryNotification } from '@/lib/email';

export type InquiryResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

export async function submitInquiry(formData: FormData): Promise<InquiryResult> {
  const raw = {
    teacher_id: String(formData.get('teacher_id') ?? ''),
    studio_name: String(formData.get('studio_name') ?? ''),
    contact_name: String(formData.get('contact_name') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    location: String(formData.get('location') ?? ''),
    message: String(formData.get('message') ?? ''),
  };
  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: flattenZodErrors(parsed.error) };
  }

  const supabase = createSupabaseServiceClient();

  // Only accept inquiries for approved (publicly visible) teachers.
  const { data: teacher } = await supabase
    .from('teachers_public')
    .select('id, display_name')
    .eq('id', parsed.data.teacher_id)
    .maybeSingle();
  if (!teacher) {
    return { ok: false, errors: { _form: 'generic' } };
  }

  const { error } = await supabase.from('inquiries').insert(parsed.data);
  if (error) {
    console.error('inquiry insert failed', error);
    return { ok: false, errors: { _form: 'generic' } };
  }

  await sendInquiryNotification({
    teacherDisplayName: teacher.display_name,
    studioName: parsed.data.studio_name,
    contactName: parsed.data.contact_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    location: parsed.data.location,
    message: parsed.data.message,
  });

  return { ok: true };
}
```

- [ ] **Step 3: Inquiry form + page**

`components/InquiryForm.tsx`:

```tsx
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
      const result: InquiryResult = await submitInquiry(fd);
      if (result.ok) setSubmitted(true);
      else setErrors(result.errors);
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
```

`app/[locale]/anfrage/[teacherId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getTeacherById } from '@/lib/queries';
import InquiryForm from '@/components/InquiryForm';

export default async function InquiryPage({
  params,
}: {
  params: Promise<{ locale: string; teacherId: string }>;
}) {
  const { locale, teacherId } = await params;
  setRequestLocale(locale);
  const teacher = await getTeacherById(teacherId);
  if (!teacher) notFound();
  const t = await getTranslations('inquiry');
  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="heading-brand text-center text-2xl">{t('title')}</h1>
      <p className="mt-3 text-center text-sm text-charcoal-soft">{t('subtitle')}</p>
      <p className="mt-2 text-center text-sm font-medium">
        {t('forTeacher', { name: teacher.display_name, city: teacher.city })}
      </p>
      <div className="mt-8">
        <InquiryForm teacherId={teacher.id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

`npm run build && npm test` pass. Then dev server: open `/de/anfrage/<test-teacher-id>`, submit a test inquiry, confirm success screen and a `new` row in `inquiries` (Supabase dashboard or `supabase db query "select studio_name, status from inquiries"`). Console should log `email skipped …` when Resend is not configured.

- [ ] **Step 5: Commit**

```bash
git add app/ lib/email.ts components/InquiryForm.tsx
git commit -m "feat: add studio inquiry flow with optional email notification"
```

---

### Task 10: Admin auth (login + guard)

**Files:**
- Create: `app/actions/auth.ts`
- Create: `app/admin/login/page.tsx`, `components/AdminLoginForm.tsx`
- Create: `app/admin/(protected)/layout.tsx`

**Interfaces:**
- Consumes: `createSupabaseServerClient` (Task 2)
- Produces:
  - `signIn(formData: FormData): Promise<{ error: string } | never>` (redirects to `/admin` on success), `signOut(): Promise<never>` (redirects to `/admin/login`) from `app/actions/auth.ts`
  - `requireAdmin(): Promise<User>` guard used by all admin pages via the `(protected)` layout
- Note: `/admin/*` is excluded from the i18n proxy (Task 4) — plain `next/link` and hardcoded German strings here.

- [ ] **Step 1: Auth actions**

`app/actions/auth.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function signIn(formData: FormData): Promise<{ error: string }> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: 'E-Mail oder Passwort ist falsch.' };
  }
  redirect('/admin');
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
```

- [ ] **Step 2: Login page**

`components/AdminLoginForm.tsx`:

```tsx
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
```

`app/admin/login/page.tsx`:

```tsx
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import AdminLoginForm from '@/components/AdminLoginForm';

export default async function AdminLoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/admin');

  return (
    <div className="flex min-h-screen items-center justify-center bg-blush-light/40 px-6">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <Image
          src="/images/image-1200x924.png"
          alt="Sandra Leo Pilates Education"
          width={140}
          height={108}
          className="mx-auto"
        />
        <h1 className="heading-brand mt-4 text-center text-sm">Admin-Bereich</h1>
        <div className="mt-6">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Protected layout with guard + admin nav**

`app/admin/(protected)/layout.tsx`:

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  return (
    <div className="min-h-screen bg-blush-light/30">
      <header className="flex items-center justify-between border-b border-blush-light bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="flex items-center gap-3">
            <Image
              src="/images/image-1200x924.png"
              alt="Sandra Leo Pilates Education"
              width={56}
              height={43}
            />
            <span className="heading-brand text-xs">Trainer-CRM</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin" className="hover:text-blush-deep">
              Trainer
            </Link>
            <Link href="/admin/anfragen" className="hover:text-blush-deep">
              Anfragen
            </Link>
          </nav>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-charcoal-soft hover:text-charcoal"
          >
            Abmelden
          </button>
        </form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

Also create a minimal placeholder `app/admin/(protected)/page.tsx` (replaced in Task 11):

```tsx
export default function AdminHome() {
  return <p>Trainer-Tabelle folgt.</p>;
}
```

- [ ] **Step 4: Create Sandra's admin user + verify**

Create the admin user (ask the user for the desired admin email/password, or use `leoharling@gmx.de` + a generated password to hand over):

```bash
supabase auth users create --help 2>/dev/null || echo "create via dashboard"
```

If the CLI lacks user creation, instruct: Supabase Dashboard → Authentication → Users → Add user (email + password, auto-confirm). Then verify:

```bash
npm run build && npm run dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" -L http://localhost:3000/admin        # → renders login redirect chain, final 200 on /admin/login
curl -s http://localhost:3000/admin/login | grep -c "Admin-Bereich"
kill %1
```

Log in manually (or via Playwright MCP) with the admin credentials → should land on `/admin` with the CRM header. `/admin` without session must redirect to `/admin/login`.

- [ ] **Step 5: Commit**

```bash
git add app/actions/auth.ts app/admin components/AdminLoginForm.tsx
git commit -m "feat: add admin login with Supabase Auth and protected layout"
```

---

### Task 11: Admin CRM — trainer table and detail view

**Files:**
- Create: `app/actions/admin.ts`
- Create: `app/admin/(protected)/trainer/[id]/page.tsx`
- Create: `components/admin/StatusBadge.tsx`, `components/admin/TeacherActions.tsx`
- Modify: `app/admin/(protected)/page.tsx` (replace placeholder with the table)

**Interfaces:**
- Consumes: `createSupabaseServerClient` (Task 2), `TeacherRow`, `photoUrl` (Task 2), option label maps — admin uses hardcoded German labels defined in `components/admin/StatusBadge.tsx` (exported `ADMIN_LABELS`)
- Produces:
  - `updateTeacherStatus(id: string, status: TeacherStatus): Promise<void>`, `deleteTeacher(id: string): Promise<void>` from `app/actions/admin.ts` (both revalidate `/admin` and the public pages)
  - `<StatusBadge status={TeacherStatus} />`, `ADMIN_LABELS` (German maps for styles/equipment/offerings/locations/selfAssessments/genders/status)

- [ ] **Step 1: Admin server actions**

`app/actions/admin.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { TeacherStatus, InquiryStatus } from '@/lib/types';

async function requireAdminClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  return supabase;
}

function revalidatePublic() {
  revalidatePath('/', 'layout'); // covers /de, /en, profiles
  revalidatePath('/admin');
}

export async function updateTeacherStatus(
  id: string,
  status: TeacherStatus
): Promise<void> {
  const supabase = await requireAdminClient();
  const { error } = await supabase
    .from('teachers')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(`Status-Update fehlgeschlagen: ${error.message}`);
  revalidatePublic();
}

export async function deleteTeacher(id: string): Promise<void> {
  const supabase = await requireAdminClient();
  const { error } = await supabase.from('teachers').delete().eq('id', id);
  if (error) throw new Error(`Löschen fehlgeschlagen: ${error.message}`);
  revalidatePublic();
  redirect('/admin');
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus
): Promise<void> {
  const supabase = await requireAdminClient();
  const { error } = await supabase
    .from('inquiries')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(`Status-Update fehlgeschlagen: ${error.message}`);
  revalidatePath('/admin/anfragen');
}
```

- [ ] **Step 2: Status badge + German label maps**

`components/admin/StatusBadge.tsx`:

```tsx
import type { TeacherStatus, InquiryStatus } from '@/lib/types';

export const ADMIN_LABELS = {
  status: {
    pending: 'Neu',
    approved: 'Freigegeben',
    rejected: 'Abgelehnt',
  } as Record<TeacherStatus, string>,
  inquiryStatus: {
    new: 'Neu',
    contacted: 'Kontaktiert',
    placed: 'Vermittelt',
  } as Record<InquiryStatus, string>,
  genders: { female: 'Weiblich', male: 'Männlich', diverse: 'Divers' },
  styles: {
    classical: 'Klassisch',
    contemporary: 'Contemporary',
    rehab: 'Rehabilitativ / therapeutisch',
    athletic: 'Sportlich / athletic',
    prepostnatal: 'Pre-/Postnatal',
    seniors: 'Senioren',
    other: 'Sonstiges',
  },
  equipment: {
    mat: 'Matte',
    reformer: 'Reformer',
    cadillac: 'Cadillac / Trapeze Table',
    chair: 'Chair',
    ladder_barrel: 'Ladder Barrel',
    spine_corrector: 'Spine Corrector / Arc Barrel',
    springboard: 'Springboard',
    tower: 'Tower',
    small_props: 'Kleingeräte',
  },
  offerings: {
    personal_training: 'Personal Training',
    duet: 'Duett',
    small_groups: 'Kleingruppen',
    group_classes: 'Gruppenkurse',
    workshops: 'Workshops',
    teacher_training: 'Teacher Training',
    online: 'Online',
  },
  teachingLocations: {
    own_studio: 'Eigenes Studio',
    other_studio: 'Fremdstudio',
    gym: 'Fitnessstudio',
    physio_practice: 'Physiopraxis',
    clients_home: 'Beim Kunden zuhause',
    online: 'Online',
  },
  selfAssessments: {
    beginner: 'Einsteiger',
    advanced: 'Fortgeschritten',
    very_experienced: 'Sehr erfahren',
    expert: 'Experte',
  },
} as const;

export function labelList(
  keys: string[],
  map: Record<string, string>
): string {
  return keys.map((k) => map[k] ?? k).join(', ');
}

const statusStyles: Record<TeacherStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }: { status: TeacherStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
    >
      {ADMIN_LABELS.status[status]}
    </span>
  );
}

const inquiryStyles: Record<InquiryStatus, string> = {
  new: 'bg-amber-100 text-amber-800',
  contacted: 'bg-blue-100 text-blue-800',
  placed: 'bg-green-100 text-green-800',
};

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${inquiryStyles[status]}`}
    >
      {ADMIN_LABELS.inquiryStatus[status]}
    </span>
  );
}
```

- [ ] **Step 3: Trainer table (CRM main view)**

Replace `app/admin/(protected)/page.tsx`:

```tsx
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
          <Link href="/admin" className="rounded-full border border-blush px-3 py-1 hover:bg-blush-light">
            Alle
          </Link>
          <Link href="/admin?status=pending" className="rounded-full border border-blush px-3 py-1 hover:bg-blush-light">
            Neu
          </Link>
          <Link href="/admin?status=approved" className="rounded-full border border-blush px-3 py-1 hover:bg-blush-light">
            Freigegeben
          </Link>
          <Link href="/admin?status=rejected" className="rounded-full border border-blush px-3 py-1 hover:bg-blush-light">
            Abgelehnt
          </Link>
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
```

- [ ] **Step 4: Status action buttons (client)**

`components/admin/TeacherActions.tsx`:

```tsx
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
```

- [ ] **Step 5: Detail view (CRM contact page)**

`app/admin/(protected)/trainer/[id]/page.tsx`:

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { TeacherRow } from '@/lib/types';
import { photoUrl } from '@/lib/types';
import { StatusBadge, ADMIN_LABELS, labelList } from '@/components/admin/StatusBadge';
import TeacherActions from '@/components/admin/TeacherActions';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-charcoal-soft">{label}</dt>
      <dd className="mt-0.5 text-sm whitespace-pre-line">{value || '—'}</dd>
    </div>
  );
}

export default async function AdminTeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!data) notFound();
  const t = data as TeacherRow;
  const src = photoUrl(t.photo_path);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin" className="text-sm text-charcoal-soft hover:text-charcoal">
        ← Zurück zur Übersicht
      </Link>
      <div className="mt-4 rounded-lg border border-blush-light bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {src ? (
              <Image src={src} alt="" width={80} height={80} className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-blush-light" />
            )}
            <div>
              <h1 className="text-xl font-semibold">
                {t.first_name} {t.last_name}
              </h1>
              <p className="text-sm text-charcoal-soft">
                {t.postal_code} {t.city}, {t.country}
              </p>
              <div className="mt-1"><StatusBadge status={t.status} /></div>
            </div>
          </div>
          <TeacherActions id={t.id} status={t.status} />
        </div>

        <h2 className="heading-brand mt-8 mb-3 text-xs">Kontakt (nicht öffentlich)</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="E-Mail" value={<a href={`mailto:${t.email}`} className="text-blush-deep hover:underline">{t.email}</a>} />
          <Field label="Telefon" value={<a href={`tel:${t.phone}`} className="text-blush-deep hover:underline">{t.phone}</a>} />
          <Field label="Website / Instagram" value={t.website_instagram} />
          <Field label="Geschlecht" value={ADMIN_LABELS.genders[t.gender as keyof typeof ADMIN_LABELS.genders] ?? t.gender} />
          <Field label="Eingereicht am" value={new Date(t.created_at).toLocaleString('de-DE')} />
        </dl>

        <h2 className="heading-brand mt-8 mb-3 text-xs">Standort</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Hauptstandort" value={t.location_name} />
          <Field label="Umkreis" value={`${t.radius_km} km`} />
          <Field label="Max. Entfernung" value={`${t.max_distance_km} km`} />
          <Field label="Online-Unterricht" value={t.online_teaching ? 'Ja' : 'Nein'} />
          <Field
            label="Koordinaten"
            value={
              t.lat !== null
                ? `${t.lat.toFixed(4)}, ${t.lng?.toFixed(4)}`
                : '⚠ Standort nicht gefunden — Trainer erscheint nicht auf der Karte'
            }
          />
        </dl>

        <h2 className="heading-brand mt-8 mb-3 text-xs">Profil</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Pilates-Stile" value={labelList(t.styles, ADMIN_LABELS.styles)} />
          <Field label="Sonstiger Stil" value={t.styles_other} />
          <Field label="Geräte" value={labelList(t.equipment, ADMIN_LABELS.equipment)} />
          <Field label="Angebot" value={labelList(t.offerings, ADMIN_LABELS.offerings)} />
          <Field label="Unterrichtsorte" value={labelList(t.teaching_locations, ADMIN_LABELS.teachingLocations)} />
          <Field label="Selbsteinschätzung" value={ADMIN_LABELS.selfAssessments[t.self_assessment as keyof typeof ADMIN_LABELS.selfAssessments] ?? t.self_assessment} />
          <Field label="Unterrichtet seit" value={t.teaching_since} />
          <Field label="Jahre Erfahrung" value={t.experience_years} />
        </dl>
        <div className="mt-4 space-y-4">
          <Field label="Ausbildungen" value={t.educations} />
          <Field label="Zertifizierungen" value={t.certifications} />
          <Field label="Fortbildungen (letzte 2 Jahre)" value={t.recent_trainings} />
          <Field label="Besondere Qualität" value={t.quality_statement} />
        </div>

        {t.status === 'approved' && (
          <p className="mt-6 text-sm">
            <Link href={`/de/trainer/${t.id}`} className="text-blush-deep hover:underline">
              Öffentliches Profil ansehen →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify the full vetting loop**

With the dev server running and logged in as admin (manually or via Playwright MCP):
1. `/admin` shows the test teacher in the table (pending rows first, ⚠ if no coordinates).
2. Row click opens the detail page with contact data visible.
3. Set the test teacher to "Zurückziehen" (pending) → map at `/de` no longer shows the marker (after revalidation).
4. "Freigeben" → marker reappears.

```bash
npm run build && npm test
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add app/ components/admin/
git commit -m "feat: add admin CRM trainer table and detail view with vetting actions"
```

---

### Task 12: Admin inquiries, polish, deploy prep

**Files:**
- Create: `app/admin/(protected)/anfragen/page.tsx`, `components/admin/InquiryStatusSelect.tsx`
- Create: `app/[locale]/not-found.tsx`
- Modify: `app/layout.tsx` (favicon/OG metadata), `README.md`

**Interfaces:**
- Consumes: `updateInquiryStatus` (Task 11), `InquiryRow` (Task 2), `InquiryStatusBadge` (Task 11)

- [ ] **Step 1: Inquiries page**

`components/admin/InquiryStatusSelect.tsx`:

```tsx
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
```

`app/admin/(protected)/anfragen/page.tsx`:

```tsx
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { InquiryRow } from '@/lib/types';
import { InquiryStatusBadge } from '@/components/admin/StatusBadge';
import InquiryStatusSelect from '@/components/admin/InquiryStatusSelect';

interface InquiryWithTeacher extends InquiryRow {
  teachers: { first_name: string; last_name: string; city: string } | null;
}

export default async function AdminInquiriesPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('inquiries')
    .select('*, teachers(first_name, last_name, city)')
    .order('created_at', { ascending: false });
  const inquiries = (data ?? []) as unknown as InquiryWithTeacher[];

  return (
    <div>
      <h1 className="heading-brand mb-4 text-lg">Anfragen ({inquiries.length})</h1>
      <div className="space-y-4">
        {inquiries.length === 0 && (
          <p className="text-sm text-charcoal-soft">Noch keine Anfragen.</p>
        )}
        {inquiries.map((q) => (
          <div key={q.id} className="rounded-lg border border-blush-light bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {q.studio_name}
                  {q.location ? ` · ${q.location}` : ''}
                </p>
                <p className="text-sm text-charcoal-soft">
                  {q.contact_name} ·{' '}
                  <a href={`mailto:${q.email}`} className="text-blush-deep hover:underline">
                    {q.email}
                  </a>
                  {q.phone ? ` · ${q.phone}` : ''}
                </p>
                <p className="mt-1 text-sm">
                  Für:{' '}
                  {q.teachers ? (
                    <Link href={`/admin/trainer/${q.teacher_id}`} className="text-blush-deep hover:underline">
                      {q.teachers.first_name} {q.teachers.last_name} ({q.teachers.city})
                    </Link>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <InquiryStatusBadge status={q.status} />
                <InquiryStatusSelect id={q.id} status={q.status} />
              </div>
            </div>
            <p className="mt-3 rounded bg-blush-light/50 p-3 text-sm whitespace-pre-line">
              {q.message}
            </p>
            <p className="mt-2 text-xs text-charcoal-soft">
              {new Date(q.created_at).toLocaleString('de-DE')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 404 page and metadata polish**

`app/[locale]/not-found.tsx`:

```tsx
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('profile');
  const tn = useTranslations('nav');
  return (
    <div className="px-6 py-24 text-center">
      <h1 className="heading-brand text-xl">{t('notFound')}</h1>
      <Link href="/" className="mt-4 inline-block text-blush-deep hover:underline">
        {tn('map')} →
      </Link>
    </div>
  );
}
```

In `app/layout.tsx`, extend metadata (keep existing title/description):

```tsx
export const metadata: Metadata = {
  title: 'Pilates Teacher Finder — Sandra Leo Pilates Education',
  description:
    'Qualifizierte Pilates-Trainer in ganz Deutschland, geprüft von Sandra Leo.',
  icons: { icon: '/images/images.jpg' },
  openGraph: {
    title: 'Pilates Teacher Finder',
    description:
      'Qualifizierte Pilates-Trainer in ganz Deutschland, geprüft von Sandra Leo.',
    images: ['/images/image-1200x924.png'],
  },
};
```

- [ ] **Step 3: Rewrite README.md**

Replace the create-next-app boilerplate with: project purpose (one paragraph), setup (`npm install`, `.env.local` from `.env.example`, `supabase link` + `supabase db push`), how to run (`npm run dev`, `npm test`), admin user creation (Supabase dashboard → Authentication → add user), and env var table (the five vars from `.env.example` with one-line descriptions).

- [ ] **Step 4: Clean up test data**

Delete the test teacher and test inquiry created in Tasks 6–9 (Supabase dashboard or `supabase db query "delete from teachers where first_name='Test'"` — the inquiry cascades).

- [ ] **Step 5: Full verification**

```bash
npm test && npm run build
```

Expected: all tests pass, build clean. Then a final manual E2E pass (Playwright MCP or manual):
1. Submit a real-looking teacher application (DE form) with photo → success screen.
2. Log in at `/admin` → application visible as "Neu", detail view complete, coordinates present.
3. Freigeben → teacher appears on `/de` map and `/en` map with pink marker; profile shows no contact data anywhere in the HTML source.
4. Send an inquiry from the profile → success screen → inquiry in `/admin/anfragen`, status editable.
5. Language switcher flips DE↔EN on every public page.

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "feat: add admin inquiries view, 404 page, metadata and README"
git push -u origin main
```

---

## Deferred / needs user input

- **Supabase keys**: anon + service_role into `.env.local` (Task 2) — ask user if CLI can't fetch them.
- **Admin login**: create Sandra's user in Supabase Auth (Task 10) — needs desired email/password.
- **Resend**: `RESEND_API_KEY` + `INQUIRY_NOTIFY_EMAIL` whenever Sandra wants email notifications; app works without.
- **Vercel deploy**: `npm i -g vercel`, `vercel link`, `vercel env add` (the five env vars), `vercel deploy --prod`. Not part of this plan's tasks; run via the vercel:deploy skill when the user asks.
