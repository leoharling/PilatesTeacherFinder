-- Contact details for studios shown on the public map: full postal address,
-- phone and email (all public info from each studio's Impressum). Nullable-free
-- text with empty-string defaults so existing rows stay valid.
alter table public.studios
  add column if not exists address text not null default '',
  add column if not exists phone   text not null default '',
  add column if not exists email   text not null default '';
