# Admin CRM telepítés és üzemeltetés

## Elkészült adminoldalak

- `/admin/attekintes` – statisztikák, legutóbbi jelentkezések és aktivitás
- `/admin/allasok` – kereshető, szűrhető, lapozható álláslista
- `/admin/allasok/uj` – új állás mentése piszkozatként
- `/admin/allasok/[id]` – állásadatlap, jelentkezők, hirdetés, kérdések és előzmények
- `/admin/jelentkezok` – táblázatos és Kanban CRM-nézet
- `/admin/jelentkezok/[id]` – válaszok, dokumentumok, jegyzetek és aktivitás
- `/admin/cegek` – cégtörzs
- `/admin/email-sablon` – automatikus visszaigazolás szerkeszthető szövegrészei
- `/admin/beallitasok` – integrációs állapotok

## Adatbázis-migrációk

A meglévő migrációk után, sorrendben kell alkalmazni:

1. `supabase/migrations/202607180001_admin_crm.sql`
2. `supabase/migrations/202607180002_question_types_and_trigger_safety.sql`
3. `supabase/migrations/202607180003_partner_status_compatibility.sql`

A migrációk nem törlik a meglévő állásokat vagy jelentkezéseket. Az `archived` állások `closed` állapotba kerülnek, a korábbi CRM-státuszok pedig az új kanonikus státuszokra képeződnek le. A kérdésre adott korábbi válaszok pillanatképet kapnak, ezért a kérdés későbbi átírása vagy eltávolítása után is értelmezhetők maradnak.

Linkelt Supabase projekt esetén:

```bash
npx supabase db push
```

## Környezeti változók

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
EMAIL_FROM=Kékgalléros <info@kekgallerost.hu>
NEXT_PUBLIC_SITE_URL=https://kekgallerost.hu
```

Az automatikus e-mail a jelentkezés sikeres adatbázis-mentése után indul. Az `email_logs.delivery_key` egyedisége akadályozza meg a duplikált visszaigazolást. Küldési hiba esetén a jelentkezés megmarad, a hiba az `email_logs` táblában naplózódik.

Az önéletrajzok a privát `application-files` Supabase Storage bucketben tárolódnak, véletlenszerű tárolási kulccsal. Letöltési URL csak hitelesített adminnak, 60 másodperces élettartammal készül. Engedélyezett formátum: PDF, DOC, DOCX; maximális méret: 10 MB.

## Ellenőrzés

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Az automatizált tesztek az állásátmeneteket, publikus jelentkezési korlátozást, duplikálást, válasz-pillanatképet, opcionális CV-t, fájlellenőrzést, CRM-státuszokat, e-mail-adatvédelmet, idempotenciát és admin-only dokumentumletöltést ellenőrzik.
