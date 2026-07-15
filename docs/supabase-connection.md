# Supabase osszekotes

Supabase projekt: `kekgallerost`

A projekt mar fel van keszitve Supabase hasznalatra. A kulcsokat ne commitold; csak lokalis `.env.local` vagy Vercel Environment Variables alatt szerepeljenek.

## Szukseges ertekek helyett hasznalt env nevek

A Supabase dashboardban keresd ezeket:

- Project Settings -> API Keys
- Project Settings -> Data API vagy API Settings

Allitsd be lokalisan:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=info@kekgallerost.hu
NEXT_PUBLIC_SITE_URL=https://kekgallerost.hu
```

## Melyik kulcs mire valo

- `NEXT_PUBLIC_SUPABASE_URL`: publikus projekt URL, kliensoldalon is hasznalhato.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: publikus Supabase browser key. Csak RLS-sel vedett adatokhoz hasznaljuk.
- `SUPABASE_SERVICE_ROLE_KEY`: szerveroldali admin kulcs. Soha nem mehet kliensoldalra vagy GitHubra.

## Adatbazis migration futtatasa

1. Nyisd meg a Supabase SQL Editort.
2. Masold be ezt a fajlt:

```text
supabase/migrations/202607150001_initial_schema.sql
```

3. Futtasd le a teljes SQL-t.
4. Ellenorizd, hogy letrejottek ezek a tablak:

- `companies`
- `profiles`
- `jobs`
- `job_questions`
- `applications`
- `application_answers`
- `uploaded_files`
- `email_logs`

## App oldali helper fajlok

- `src/lib/supabase/browser.ts`: kliensoldali Supabase client.
- `src/lib/supabase/server.ts`: server component / route handler Supabase client es server admin client.
- `src/lib/env.ts`: kozponti env olvasas.

## Vercel osszekotes

A Vercel projektben add meg ugyanezeket az environment variable-okat Production, Preview es Development kornyezetben. A `SUPABASE_SERVICE_ROLE_KEY` es `RESEND_API_KEY` csak szerveroldalon hasznalhato, Next.js-ben nem kaphat `NEXT_PUBLIC_` prefixet.