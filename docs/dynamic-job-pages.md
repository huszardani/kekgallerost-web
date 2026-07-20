# Dinamikus állásoldalak

Az összes publikus állás a `/allas/[slug]` útvonalon, ugyanabból a `job-template.tsx` komponensből jelenik meg. Az admin élő előnézete és a külön admin előnézeti oldal ugyanezt a komponenst használja; állásonként nincs külön oldal, CSS vagy komponens.

## Admin munkafolyamat

1. `Admin → Állások → + Új állás`.
2. Alapadatok, fejléc, fizetés és tartalmi blokkok kitöltése.
3. Első mentés piszkozatként.
4. Főkép, galériaképek és közösségi előnézeti kép feltöltése; alt szöveg és fókuszpont beállítása.
5. Egyedi jelentkezési kérdések és opcionális kizáró szabályok megadása.
6. Előnézet, majd publikálás vagy időzítés.

Állapotok: `draft`, `ready`, `published`, `paused`, `closed`, `archived`. Publikusan csak a `published` állapot érhető el és csak ez fogad jelentkezést. Az időzített állások a megadott időpont után az első álláslista-, állásoldal- vagy jelentkezési kéréskor aktiválódnak a `activate_scheduled_jobs()` adatbázis-függvénnyel.

## Adatmodell

- `jobs`: alapadatok, SEO/publikálási adatok, fizetés, fókuszpont és életciklus.
- `job_content_blocks`: előre engedélyezett, megjeleníthető/elrejthető tartalmi blokkok.
- `job_content_items`: felsorolások, tényadatok és GYIK-elemek.
- `job_media`: főkép, galéria és közösségi kép, alt szöveg és fókuszpont.
- `job_questions`: kérdés alapadatai és belső admin-megjegyzés.
- `job_question_options`: normalizált válaszlehetőségek.
- `job_disqualification_rules`: strukturált kizáró válaszok.
- A meglévő `applications`, `application_answers` és `uploaded_files` táblák változatlanul megőrzik a korábbi jelentkezéseket.

Az adatmodell migrációja: `supabase/migrations/202607200001_dynamic_job_pages.sql`. Ez a jelenlegi fuvarszervező tartalmát is áttölti a központi blokkokba és a képeket a médiatáblába.

## Média és biztonság

A `job-media` Supabase Storage bucket nyilvános képeket tárol, de feltölteni, módosítani és törölni csak admin jogosultsággal lehet. Engedélyezett formátum: JPEG, PNG, WebP, AVIF; maximális méret: 8 MB. A szerver MIME-típust és fájlszignatúrát is ellenőriz.

A jelentkezői fájlok továbbra is privát bucketben vannak. A publikus szövegek React szöveges tartalomként jelennek meg, tetszőleges HTML vagy script nem futtatható.

## Üzemeltetés

- `NEXT_PUBLIC_SITE_URL`: az éles webhely gyökér URL-je a canonical és Open Graph URL-ekhez. Fejlesztésben az alapérték `http://localhost:3000`.
- A migráció telepítése: `npx supabase db push` a linkelt projektben.
- Ellenőrzés: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
