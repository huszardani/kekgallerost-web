# Supabase osszekotes

Supabase projekt: `kekgallerost`

A projekt fel van keszitve Supabase hasznalatra. A kulcsokat ne commitold; csak lokalis `.env.local` vagy Vercel Environment Variables alatt szerepeljenek.

## Hasznalt env nevek

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
EMAIL_FROM=Kekgalleros.hu <info@kekgallerost.hu>
NEXT_PUBLIC_SITE_URL=https://kekgallerost.hu
```

## Melyik kulcs mire valo

- `NEXT_PUBLIC_SUPABASE_URL`: publikus projekt URL, kliensoldalon is hasznalhato.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: publikus Supabase browser key. Csak RLS-sel vedett adatokhoz hasznaljuk.
- `SUPABASE_SERVICE_ROLE_KEY`: szerveroldali admin kulcs. Soha nem mehet kliensoldalra vagy GitHubra.
- `RESEND_API_KEY`: szerveroldali e-mail kulcs. Soha nem mehet kliensoldalra vagy GitHubra.
- `EMAIL_FROM`: hitelesitett felado cim Resendhez.

## Adatbazis migration statusz

Az initial migration futott, a kovetkezo REST tablak elerhetok:

- `companies`
- `profiles`
- `jobs`
- `job_questions`
- `applications`
- `application_answers`
- `uploaded_files`
- `email_logs`

Migration fajl:

```text
supabase/migrations/202607150001_initial_schema.sql
```

## App oldali helper fajlok

- `src/lib/supabase/browser.ts`: kliensoldali Supabase client.
- `src/lib/supabase/server.ts`: server component / route handler Supabase client es server admin client.
- `src/lib/env.ts`: kozponti env olvasas.

## Vercel osszekotes

A Vercel projektben ugyanezeket az environment variable-okat kell megadni Production, Preview es Development kornyezetben. A `SUPABASE_SERVICE_ROLE_KEY` es `RESEND_API_KEY` csak szerveroldalon hasznalhato, Next.js-ben nem kaphat `NEXT_PUBLIC_` prefixet.