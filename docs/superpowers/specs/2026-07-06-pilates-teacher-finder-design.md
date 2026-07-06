# Pilates Teacher Finder — Design

**Date:** 2026-07-06
**Client:** Sandra Leo (Sandra Leo Pilates Education, sandraleopilates.com)
**Status:** Approved by user (approach A, bilingual DE/EN, CRM-style admin)

## Purpose

Sandra Leo trains pilates teachers and wants to broker them to studios across Germany. Studios constantly ask her "where do I find good teachers?" — the only existing directory (DPV) excludes many good teachers. This app builds a pool of vetted teachers, shows them on a public map, and routes all studio contact through Sandra so she stays the connector (her quality seal, her placement fee).

## Core decisions (user-approved)

1. **Visibility:** Public map and profiles, but contact data (email, phone, last name) is never public. Studios send inquiries through the app; Sandra brokers the contact.
2. **Vetting:** Teachers submit an intake form (no account). Submissions are `pending` and invisible until Sandra approves them in the admin area.
3. **Admin auth:** Supabase Auth, single admin account for Sandra.
4. **Map:** Leaflet + OpenStreetMap (free, no API key). Geocoding of PLZ/city via Nominatim at submission time, server-side.
5. **Inquiries:** Stored in Supabase **and** emailed to Sandra via Resend. If no Resend API key is configured, email is skipped gracefully — inquiries still appear in the admin.
6. **Architecture:** One Next.js app (approach A). All privileged operations (form submission, geocoding, admin actions, email) run in server actions / route handlers. The browser only ever reads via the anon key + RLS.
7. **Languages:** German (default) and English, via locale-prefixed routing (`/de/...`, `/en/...`).
8. **Admin UX:** CRM-style — a readable table of all trainers, click a row to open the full record.

## Out of scope (v1)

Teacher logins/self-editing, payments/invoicing, studio accounts, DPV integration, more languages, native mobile app.

## Tech stack

- Next.js 16 (App Router, already scaffolded), TypeScript, Tailwind CSS v4
- `next-intl` for i18n (DE default, EN secondary)
- Supabase: Postgres, Auth, Storage (project ref `olgrifbkczkrqpsuxych`, linked via `supabase/` folder with migrations)
- Leaflet + react-leaflet + marker clustering
- Nominatim (OpenStreetMap) for geocoding — server-side, with proper User-Agent
- Resend for email notifications (optional until API key provided)
- Deploy target: Vercel; repo `github.com/leoharling/PilatesTeacherFinder`

## Pages

All pages exist under `/de` and `/en`; German is the default locale. Language switcher in the header.

### 1. `/` — Map (home)
- Full-viewport Leaflet map centered on Germany with clustered markers for **approved** teachers.
- Markers sit at city-level coordinates (geocoded from PLZ/city), never exact addresses.
- Marker click → compact card: photo, display name, city, teaching radius, styles, experience level, online badge, Sandra's quality seal.
- Filter panel / list alongside the map: filter by style, equipment, offering type, online availability; search by PLZ/city.
- Card links to the full profile.

### 2. `/trainer/[id]` — Public profile
- Photo, display name (**first name + last-name initial**, e.g. "Anna K."), city + radius, online availability.
- Styles, equipment, offerings, teaching locations, experience (years, since), certifications/trainings, self-assessment level, quality statement.
- **Never shown:** email, phone, full last name, website/Instagram handle.
- Prominent "Trainer anfragen" / "Request this trainer" button → inquiry form.

### 3. `/anfrage/[teacherId]` — Studio inquiry
- Fields: studio/contact name, studio name, email, phone (optional), location, message.
- On submit (server action): row inserted into `inquiries`, email sent to Sandra if Resend is configured, confirmation screen shown.

### 4. `/registrieren` — Teacher intake form
Full form per Sandra's spec, in sections:
- **Persönliche Angaben:** Vorname, Nachname, Geschlecht, E-Mail, Telefon, Website/Instagram
- **Standort:** Hauptstandort, PLZ, Stadt, Land, Umkreis (km), Online-Unterricht ja/nein
- **Pilates-Stil (multi):** Klassisch, Contemporary, Rehabilitativ/therapeutisch, Sportlich/athletic, Pre-/Postnatal, Senioren, Sonstiges (free text)
- **Geräte (multi):** Matte, Reformer, Cadillac/Trapeze Table, Chair, Ladder Barrel, Spine Corrector/Arc Barrel, Springboard, Tower, Kleingeräte
- **Erfahrung:** unterrichtet seit (Jahr), Jahre Erfahrung, abgeschlossene Ausbildungen, Zertifizierungen, Fortbildungen der letzten 2 Jahre
- **Qualitätsprofil:** Selbsteinschätzung (Einsteiger/Fortgeschritten/Sehr erfahren/Experte), besondere Qualität (free text)
- **Unterrichtsangebot (multi):** Personal Training, Duett, Kleingruppen, Gruppenkurse, Workshops, Teacher Training, Online
- **Unterrichtsorte (multi):** Eigenes Studio, Fremdstudio, Fitnessstudio, Physiopraxis, Beim Kunden zuhause, Online; maximale Entfernung (km)
- **Foto:** image upload (jpg/png/webp, client-side downscale, max ~2 MB) → Supabase Storage
- **Bestätigung:** checkbox "Angaben korrekt" (required) + privacy consent
- On submit (server action): validate (zod), upload photo, geocode PLZ+Stadt via Nominatim → lat/lng, insert as `status = 'pending'`, show a friendly "Sandra meldet sich" confirmation.

### 5. `/admin` — Sandra's CRM
- Supabase Auth email/password login (single admin). Unauthenticated visitors see only the login form; all admin routes are server-guarded.
- **Trainer table (main view):** one readable table of ALL trainers — columns: photo thumbnail, name, city, status (pending/approved/rejected, color-coded), styles, experience, submitted date. Sortable and filterable by status; pending submissions surface at the top by default.
- **Click a row → detail view:** the complete record including contact data (email, phone, website/Instagram) — laid out like a CRM contact page. Actions: **Freigeben** (approve), **Ablehnen** (reject), **Zurückziehen** (unpublish), delete.
- **Anfragen tab:** table of studio inquiries (studio, contact, teacher requested, date, status new/contacted/placed). Click → full message + contact data; Sandra updates the status as she works them.

## Data model (`supabase/migrations/`)

### `teachers`
All intake fields, plus:
- `id uuid pk`, `created_at`, `updated_at`
- `status text check in ('pending','approved','rejected')` default `'pending'`
- `first_name`, `last_name`, `gender`, `email`, `phone`, `website_instagram`
- `location_name`, `postal_code`, `city`, `country`, `radius_km int`, `online_teaching bool`
- `styles text[]`, `styles_other text`, `equipment text[]`
- `teaching_since int`, `experience_years int`, `educations text`, `certifications text`, `recent_trainings text`
- `self_assessment text`, `quality_statement text`
- `offerings text[]`, `teaching_locations text[]`, `max_distance_km int`
- `photo_path text`, `lat double precision`, `lng double precision`

### `teachers_public` (view)
Approved teachers only; exposes display-safe columns plus computed `display_name` (first name + last initial). **Excludes** email, phone, website_instagram, last_name. The anon role can select only this view.

### `inquiries`
- `id`, `created_at`, `teacher_id fk → teachers`
- `studio_name`, `contact_name`, `email`, `phone`, `location`, `message`
- `status text check in ('new','contacted','placed')` default `'new'`

### Storage
Bucket `teacher-photos`, public read, insert via server only.

### RLS
- `teachers`: RLS on. No anon select/update/delete. Inserts happen via the server (service role) from the intake form's server action. Authenticated admin: full select/update/delete.
- `teachers_public` view: `security_invoker = off` with grant to anon (read-only, approved rows only by definition of the view).
- `inquiries`: RLS on. Inserts via server action; select/update only for authenticated admin.

## Server behavior

- **Server actions** for: intake submission (validate → photo upload → geocode → insert), inquiry submission (insert → email), admin approve/reject/unpublish/delete, inquiry status updates.
- **Geocoding:** Nominatim `https://nominatim.openstreetmap.org/search?postalcode=...&city=...&country=...`, User-Agent identifying the app, one request per submission (well within rate limits). If geocoding fails, save the teacher anyway with null lat/lng and flag it in admin ("Standort nicht gefunden — bitte prüfen").
- **Email:** Resend, `RESEND_API_KEY` env var; recipient Sandra's email (env var `INQUIRY_NOTIFY_EMAIL`). Absent key → log and skip.
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional), `INQUIRY_NOTIFY_EMAIL`.

## i18n

- `next-intl` with `[locale]` segment; locales `de` (default) and `en`.
- All UI strings in `messages/de.json` and `messages/en.json`.
- Teacher free-text content (quality statement, certifications) is shown as submitted, untranslated.
- Locale switcher in the header; German is the default for bare URLs.

## Design language

Sandra Leo Pilates Education brand: soft pink (from logo, ~#F5C6D8) as accent, charcoal (#3A3A3A) text, white background, generous whitespace, letter-spaced uppercase headings echoing the logo. Assets: `public/images/image-1200x924.png` (pink logo on transparent), `public/images/images.jpg` (charcoal-on-pink icon). Favicon/OG image derived from the SL monogram. Photography from sandraleopilates.com where appropriate.

## Error handling

- Form validation with zod on the server; inline field errors in the form (localized).
- Photo upload failures block submission with a clear message; oversized images are downscaled client-side first.
- Geocoding failure does not block submission (see above).
- Email failure never blocks inquiry storage.
- Admin actions show success/error toasts; all mutations revalidate the affected pages.

## Testing

- Unit tests for validation schemas and the geocoding/display-name helpers (vitest).
- Integration smoke: build passes, key routes render (map page, form, admin login).
- Manual E2E before launch: submit teacher → approve in admin → appears on map → send inquiry → appears in admin (and email if configured).

## Milestones

1. Supabase schema + migrations + storage bucket, `supabase/` folder linked to project
2. i18n scaffold, layout, brand styling
3. Intake form + photo upload + geocoding
4. Public map + profile pages
5. Inquiry flow (+ email)
6. Admin CRM (auth, trainer table, detail view, inquiries)
7. Polish, tests, deploy to Vercel
