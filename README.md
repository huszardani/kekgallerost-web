# kekgallerost-web

Kekgallerost.hu webapp alap technikai kornyezet.

- Domain: `kekgallerost.hu`
- Kuldo e-mail: `info@kekgallerost.hu`
- GitHub repo: `kekgallerost-web`
- Vercel projekt: `kekgallerost-web`
- Supabase projekt: `kekgallerost`
- Supabase regio: EU
- Cel: allashirdetesi es jelentkezeskezelo rendszer admin es partner felulettel

## Technologiai alap

- Next.js App Router
- TypeScript
- Supabase Auth, Postgres, Row Level Security es kesobb Storage
- Resend tranzakcios e-mailekhez
- Vercel deploy

## URL struktura

- `/allasok` - publikus allaslista
- `/allas/[slug]` - publikus allas adatlap es jelentkezes
- `/admin` - belso admin felulet
- `/partner` - partner felulet

## Helyi inditas

1. Fuggosegek telepitese:

```bash
npm install
```

2. Kornyezeti valtozok letrehozasa:

```bash
cp .env.example .env.local
```

3. Toltsd ki a `.env.local` ertekeit Supabase es Resend kulcsokkal.

4. Fejlesztoi szerver:

```bash
npm run dev
```

5. Nyisd meg:

```text
http://localhost:3000
```

## Kornyezeti valtozok

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=info@kekgallerost.hu
NEXT_PUBLIC_SITE_URL=https://kekgallerost.hu
```

Fontos:

- `NEXT_PUBLIC_*` valtozok kliensoldalra is kikerulhetnek.
- `SUPABASE_SERVICE_ROLE_KEY` es `RESEND_API_KEY` csak szerveroldalon hasznalhato.
- Eles kulcsot ne commitolj.

## Supabase setup

1. Supabase projekt: `kekgallerost`, EU regio.
2. A Supabase SQL Editorban futtasd:

```text
supabase/migrations/202607150001_initial_schema.sql
```

3. Kapcsold be a szukseges Auth provider(eke)t. Indulashoz eleg az e-mail login.
4. Hozd letre az elso admin profilt service role-lal vagy SQL-bol egy meglevo `auth.users` rekordhoz.
5. Kesobb hozz letre Storage bucketet jelentkezesi fajlokhoz:

```text
application-files
```

Supabase kapcsolat es kulcskezeles: `docs/supabase-connection.md`.

## Jogosultsagok

Az indulo szerepkorok:

- `admin`
- `partner`

Reszletes terv: `docs/roles.md`.

## DNS es e-mail

DNS, Vercel domain, Resend verification, SPF, DKIM es DMARC jegyzet:

```text
docs/dns-and-email.md
docs/resend-setup.md
docs/application-email-flow.md
```

## Manualis indulasi ellenorzolista

### GitHub

- Repo: `kekgallerost-web`.
- A repo gyokere ez a mappa legyen, ne a korabbi GrapIt vagy statikus oldal.
- Ne commitolj `.env` vagy `.env.local` fajlokat.

### Vercel

- Projekt: `kekgallerost-web`.
- Framework preset: Next.js.
- Add meg az environment variable-okat Production, Preview es Development kornyezetben.
- Add hozza a domaint: `kekgallerost.hu`.
- Allitsd be a `www` atiranyitast az apex domainre.

### Supabase

- Projekt: `kekgallerost`, EU regio.
- Futtasd az initial migration SQL-t.
- Masold at a Project URL-t es publishable/anon key-t a Vercel env valtozokba.
- A service role vagy secret key csak szerveroldali env valtozoba keruljon.
- Hozd letre az elso admin felhasznalot es profilt.
- Kesobb hozd letre az `application-files` Storage bucketet.

### Resend

- Add hozza a `kekgallerost.hu` domaint.
- Hitelesitsd a domaint a Resend altal adott DNS rekordokkal.
- Hozz letre API kulcsot.
- Allitsd be: `RESEND_FROM_EMAIL=info@kekgallerost.hu`.

### Domain szolgaltato

- Allitsd be a Vercelhez szukseges `A` es `CNAME` rekordokat.
- Allitsd be a Resend DKIM/domain verification rekordokat.
- Ellenorizd, hogy csak egy SPF rekord van.
- Add hozza vagy frissitsd a DMARC rekordot.

## Kovetkezo fejlesztesi lepesek

1. Jelentkezesi urlap elkeszitese `/allas/[slug]` alatt.
2. Admin/partner auth guard es layout kialakitasa.
3. Allashirdetes CRUD admin es partner felulethez.
4. Jelentkezes statuszkezeles es Resend e-mail ertesitesek.