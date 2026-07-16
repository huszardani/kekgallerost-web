# Adatbázis és jogosultságok (Supabase)

Ez a rész a `supabase/migrations` alatti migrációkra, a Supabase Auth profilokra és a private Storage bucketre épül. A korai `202607150001_initial_schema.sql` migrációt nem cseréli le: a két `20260716...` migráció kompatibilisen kiegészíti és szigorítja.

## Migráció futtatása

Helyi Supabase esetén:

```bash
supabase start
supabase db reset
```

A `db reset` sorrendben futtatja a migrációkat, majd az opcionális `supabase/seed.sql` demo adatokat. A demo jelszavakat éles környezetben tilos használni.

Már összekötött távoli projektnél:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

Távoli éles adatbázison a seedet ne futtasd. A migráció előtt készíts Supabase backupot, különösen akkor, ha az initial sémában már vannak adatok.

## Első admin létrehozása

1. Supabase Dashboard → Authentication → Users → Add user.
2. Másold ki a létrehozott user UUID-ját.
3. Futtasd az SQL Editorban:

```sql
insert into public.profiles (id, email, full_name, role, company_id)
values (
  '<AUTH_USER_UUID>',
  'admin@pelda.hu',
  'Rendszer Admin',
  'admin',
  null
)
on conflict (id) do update
set role = 'admin', company_id = null, is_active = true;
```

Ezután az admin a `/bejelentkezes` oldalon lép be. A service role kulcs kizárólag szerveroldali env változó lehet.

## Partner céghez rendelése

Az admin a `/admin` oldalon:

1. létrehozza a céget;
2. a „Partner meghívása” űrlapon megadja az e-mailt és a céget;
3. a rendszer Supabase Auth meghívót hoz létre és beszúrja a `profiles` rekordot;
4. már létező partner profil cégét a partnerlistában át lehet állítani.

SQL-ből meglévő Auth userhez:

```sql
insert into public.profiles (id, email, full_name, role, company_id)
values ('<AUTH_USER_UUID>', 'partner@pelda.hu', 'Partner Név', 'partner', '<COMPANY_UUID>')
on conflict (id) do update
set role = 'partner', company_id = excluded.company_id, is_active = true;
```

A `partner_requires_company` constraint miatt aktív partner nem maradhat cég nélkül.

## RLS működése

Minden üzleti táblán aktív a Row Level Security:

- admin: teljes CRUD minden kért táblán;
- partner: kizárólag a `profiles.company_id` szerinti cég, állások, kérdések, jelentkezések, válaszok és fájlmetaadatok;
- anon: csak aktív céghez tartozó publikált állások és azok kérdései olvashatók;
- anon: jelentkezést, választ és fájlmetaadatot csak publikált álláshoz írhat, de ezeket nem olvashatja vissza;
- partner közvetlen `applications UPDATE` policy nincs.

Helper függvények:

- `public.is_admin()`
- `public.current_user_company_id()`
- `public.is_partner_for_company(company_id)`

A partner jelentkezőmódosítása a `public.partner_update_application(...)` SECURITY DEFINER RPC-n megy át. Az RPC csak a `status`, `partner_note`, `callback_at` és `last_contacted_at` mezőket írja, és adatbázisban ellenőrzi a cégkapcsolatot. A frontend elrejtése nem része a biztonsági modellnek.

## Fájlfeltöltés

A migráció létrehozza vagy private-ra állítja az `application-files` bucketet, 10 MB fájlméretlimittel.

Útvonal:

```text
applications/{application_id}/{uuid}-{tisztított_fájlnév}
```

A publikus űrlap a `/api/applications` szerver route-on küldi a jelentkezést. A route újra ellenőrzi, hogy az állás `published`, a kérdés valóban az álláshoz tartozik, a kötelező válaszok megvannak, és a fájl PDF/Word/JPEG/PNG/WebP, legfeljebb 10 MB. Hiba esetén törli az adott folyamatban már feltöltött objektumokat és az application rekordot.

Storage RLS:

- anon nem listázhat és nem olvashat objektumot;
- admin minden `application-files` objektumot kezelhet;
- partner csak a saját cége állásjelentkezéseihez tartozó objektumot olvashat;
- a letöltési route 60 másodperces signed URL-t ad, miután a fájlmetaadat SELECT-jét az RLS engedte.

## Új állás létrehozása

1. Admin belép a `/admin` oldalra.
2. Kiválasztja a céget, megadja a címet és az egyedi slugot.
3. Szerkeszti a rövid/részletes leírást, helyszínt, foglalkoztatást, bért és hero kép URL-t.
4. `draft`, `published`, `closed` vagy `archived` státuszt állít.
5. Az állás kártyájában kérdéseket ad hozzá, típust és sorrendet állít, vagy töröl.

Csak a `published` státuszú állás jelenik meg a `/allasok` listán és a `/allas/[slug]` oldalon. Első publikáláskor a felület kitölti a `published_at` mezőt.

## Jelentkezés és e-mail

A route létrehozza:

1. az `applications` rekordot;
2. az `application_answers` rekordokat;
3. a Storage objektumokat és az `uploaded_files` metaadatokat;
4. ezután meghívja a `sendApplicationConfirmationEmail(application)` integrációs pontot.

Ha `RESEND_API_KEY` nincs beállítva, a jelentkezés sikeres marad, az e-mail küldés `skipped`. Valós credential nincs a repóban. Beállított Resend esetén a küldés eredménye az existing `email_logs` táblába kerül.

## Partner CSV export

A `/api/partner/export` route ugyanazzal a bejelentkezett Supabase sessionnel kérdezi le az adatokat. A jobs és applications SELECT-eket az RLS cégre szűri; a route nem service role klienssel exportál. A CSV cellákat idézőjelezi és a táblázatképlet-injektálásra alkalmas kezdő karaktereket semlegesíti.

## RLS tesztek

Az opcionális seed után futtasd helyi adatbázison:

```bash
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

A teszt tranzakcióban és rollbackkel ellenőrzi:

- admin minden céget/jelentkezést lát;
- partner másik cégből sem állást, sem jelentkezést nem lát;
- anon csak publikált állást lát, privát rekordokat nem;
- anon publikált állásra tud jelentkezni, draftra nem;
- partner a megengedett mezőket saját jelentkezőn RPC-vel módosíthatja;
- más cég jelentkezőjének módosítása hibát ad;
- az exporttal azonos RLS-határolt join nem tartalmaz másik céget.

Helyi Supabase vagy összekötött tesztprojekt nélkül az SQL policy-k tényleges futásidejű viselkedése nem ellenőrizhető; a TypeScript/build ellenőrzés ezt nem helyettesíti.

