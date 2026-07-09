-- Pilates studios shown on the public map alongside teachers. Public info
-- (name, city, website, coordinates) — anyone may read; only the service role
-- (seeding) and authenticated admin may write.
create table public.studios (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  city text not null,
  website text not null default '',
  lat double precision,
  lng double precision,
  source text not null default 'seed'
);

alter table public.studios enable row level security;

create policy "public read studios" on public.studios
  for select to anon, authenticated using (true);

create policy "authenticated manage studios" on public.studios
  for all to authenticated using (true) with check (true);
