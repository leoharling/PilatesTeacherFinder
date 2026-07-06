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
