# Pilates Teacher Finder

A directory site for **Sandra Leo Pilates Education**: qualified Pilates
teachers across Germany can apply with their profile and a photo; Sandra
vets each application in an admin CRM before it appears on a public,
searchable map (DE/EN). Studios and clients can find a nearby teacher on
the map and send an inquiry, which lands in the same admin area for
follow-up.

Built with Next.js (App Router), Supabase (Postgres, Auth, Storage), and
next-intl for German/English localization.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the env template and fill in the values (see table below):

   ```bash
   cp .env.example .env.local
   ```

3. Link the local project to the Supabase project and push the database
   schema (tables, RLS policies, storage bucket):

   ```bash
   npx supabase link
   npx supabase db push
   ```

## Running

- Start the dev server:

  ```bash
  npm run dev
  ```

  App runs at [http://localhost:3000](http://localhost:3000) (redirects to
  `/de`).

- Run the test suite:

  ```bash
  npm test
  ```

- Production build:

  ```bash
  npm run build
  ```

## Admin access

There is no self-serve signup for the admin CRM. Create Sandra's login
directly in the Supabase dashboard:

1. Open the project in the [Supabase dashboard](https://supabase.com/dashboard).
2. Go to **Authentication → Users → Add user**.
3. Enter her email and a password (or send an invite), then have her sign
   in at `/admin/login`.

Once logged in, the admin area lets her review and approve/reject teacher
applications (`/admin`) and manage studio inquiries (`/admin/anfragen`).

## Environment variables

Defined in `.env.example`; copy to `.env.local` and fill in:

| Variable                        | Description                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`       | Supabase project URL (public, used by the browser client).                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Supabase anon/public API key (public, respects Row Level Security).                            |
| `SUPABASE_SERVICE_ROLE_KEY`      | Supabase service role key — server-only, bypasses RLS (used for intake/inquiry writes and storage; admin actions use the cookie-bound client under RLS instead). |
| `RESEND_API_KEY`                 | Optional. Resend API key for sending inquiry notification emails.                              |
| `INQUIRY_NOTIFY_EMAIL`           | Optional. Address that receives an email when a new studio inquiry comes in.                   |

The app works without the two Resend variables — email notifications are
simply skipped if they're unset.
