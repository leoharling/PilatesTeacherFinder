-- Reduce public exposure of teacher profiles:
--  * display_name is now the first name only (previously "First L.")
--  * postal_code and experience_years are dropped from the public read model
--    entirely, so they cannot appear in any anon payload.
-- The base `teachers` table still holds these fields for the admin CRM.
drop view if exists public.teachers_public;

create view public.teachers_public
  with (security_invoker = off) as
  select
    id,
    first_name as display_name,
    city,
    country,
    radius_km,
    online_teaching,
    styles,
    styles_other,
    equipment,
    teaching_since,
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
