# kekgallerost-web

Kékgallérost.hu webapp alap technikai környezet.

- Domain: `kekgallerost.hu`
- Küldő e-mail: `info@kekgallerost.hu`
- GitHub repo: `kekgallerost-web`
- Vercel projekt: `kekgallerost-web`
- Supabase projekt: `kekgallerost`
- Supabase régió: EU
- Cél: álláshirdetési és jelentkezéskezelő rendszer admin és partner felülettel

## Technológiai alap

- Next.js App Router
- TypeScript
- Supabase Auth, Postgres, Row Level Security és később Storage
- Resend tranzakciós e-mailekhez
- Vercel deploy

## URL struktúra

- `/allasok` - publikus álláslista
- `/allas/[slug]` - publikus állás adatlap és jelentkezés
- `/admin` - belső admin felület
- `/partner` - partner felület

## Helyi indítás

1. Függőségek telepítése:

```bash
npm install
```

2. Környezeti változók létrehozása:

```bash
cp .env.example .env.local
```

3. Töltsd ki a `.env.local` értékeit Supabase és Resend kulcsokkal.

4. Fejlesztői szerver:

```bash
npm run dev
```

5. Nyisd meg:

```text
http://localhost:3000
```

## Környezeti változók

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=info@kekgallerost.hu
NEXT_PUBLIC_SITE_URL=https://kekgallerost.hu
```

Fontos:

- `NEXT_PUBLIC_*` változók kliensoldalra is kikerülhetnek.
- `SUPABASE_SERVICE_ROLE_KEY` és `RESEND_API_KEY` csak szerveroldalon használható.
- Éles kulcsot ne commitolj.

## Supabase induló setup

1. Hozz létre új Supabase projektet:

```text
Name: kekgallerost
Region: EU
```

2. A Supabase SQL Editorban futtasd:

```text
supabase/migrations/202607150001_initial_schema.sql
```

3. Kapcsold be a szükséges Auth provider(eke)t. Induláshoz elég az e-mail login.

4. Hozd létre az első admin profilt service role-lal vagy SQL-ből egy meglévő `auth.users` rekordhoz.

5. Később hozz létre Storage bucketet jelentkezési fájlokhoz:

```text
application-files
```

## Jogosultságok

Az induló szerepkörök:

- `admin`
- `partner`

Részletes terv: `docs/roles.md`.

## DNS és e-mail

DNS, Vercel domain, Resend verification, SPF, DKIM és DMARC jegyzet:

```text
docs/dns-and-email.md
```

## Manuális indulási ellenőrzőlista

### GitHub

- Hozz létre új, külön repót: `kekgallerost-web`.
- A repo gyökere ez a mappa legyen, ne a korábbi GrapIt vagy statikus oldal.
- Állíts be branch protectiont a `main` branchre, ha többen dolgoztok rajta.
- Ne commitolj `.env` vagy `.env.local` fájlokat.

### Vercel

- Hozz létre projektet: `kekgallerost-web`.
- Kösd össze a `kekgallerost-web` GitHub repóval.
- Framework preset: Next.js.
- Add meg az environment variable-öket production, preview és development környezetben.
- Add hozzá a domaint: `kekgallerost.hu`.
- Állítsd be a `www` átirányítást az apex domainre.

### Supabase

- Hozz létre projektet: `kekgallerost`, EU régióban.
- Futtasd az initial migration SQL-t.
- Másold át a Project URL-t és anon key-t a Vercel env változókba.
- A service role key csak szerveroldali env változóba kerüljön.
- Hozd létre az első admin felhasználót és profilt.
- Később hozd létre az `application-files` Storage bucketet.

### Resend

- Hozz létre vagy válaszd ki a Resend fiókot.
- Add hozzá a `kekgallerost.hu` domaint.
- Hitelesítsd a domaint a Resend által adott DNS rekordokkal.
- Hozz létre API kulcsot.
- Állítsd be: `RESEND_FROM_EMAIL=info@kekgallerost.hu`.

### Domain szolgáltató

- Állítsd be a Vercelhez szükséges `A` és `CNAME` rekordokat.
- Állítsd be a Resend DKIM/domain verification rekordokat.
- Ellenőrizd, hogy csak egy SPF rekord van.
- Add hozzá vagy frissítsd a DMARC rekordot.
- Várd meg a DNS propagációt, majd ellenőrizd Vercelben és Resendben.

## Következő fejlesztési lépések

1. Supabase kliens bevezetése route handler és server component használatra.
2. Jelentkezési űrlap elkészítése `/allas/[slug]` alatt.
3. Admin/partner auth guard és layout kialakítása.
4. Álláshirdetés CRUD admin és partner felülethez.
5. Jelentkezés státuszkezelés és Resend e-mail értesítések.
