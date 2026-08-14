# Jelentkezési e-mailek tartós újrapróbálása

Az alkalmazás a sikeresen elmentett jelentkezés után három, egymástól független sort hoz létre az `email_logs` táblában: jelentkező, admin és partner. Az első küldési kísérlet az API-kérésben indul, de hibája nem változtatja meg a jelentkezés sikeres HTTP-válaszát.

Az újrapróbálási rend: az első hiba után 5 perc, a második után 30 perc. Egy értesítéshez legfeljebb három automatikus kísérlet tartozik. A `delivery_key` minden próbálkozásnál változatlan; az adatbázis részleges egyedi indexe és az atomi claim védi a párhuzamos feldolgozástól. Ugyanez a kulcs kerül a Resend `Idempotency-Key` fejlécébe, ezért a szolgáltatói siker utáni adatbázishiba 24 órán belüli újrapróbálása sem küld újabb példányt.

A jelentkezés már a saját tartós sorában rögzíti az e-mail-kézbesítési igényt. Ha a kezdeti queue-létrehozás hibázik, a következő worker-futás csak a ténylegesen hiányzó címzetti sorokat hozza létre. Ha a Resend átvétele 24 óra után sem igazolható biztonságosan, a rendszer nem küldi el automatikusan újra a levelet, hanem `manual_review_required` állapotot rögzít, amely az adminfelületen látható.

## Production aktiválás – külön jóváhagyással

1. Alkalmazd sorrendben mindkét migrációt:
   - `202608110001_application_email_delivery_retries.sql`;
   - `202608140001_application_email_delivery_retry_hardening.sql`.
2. Ellenőrizd, hogy mindkét migráció sikeresen szerepel a távoli Supabase migrációs előzményekben, és az új oszlopok/RPC-k elérhetők.
3. Hozz létre egy legalább 32 bájtos véletlen titkot. Ugyanaz az érték kerüljön:
   - a Vercel Production `APPLICATION_EMAIL_RETRY_SECRET` változójába;
   - a Supabase Vault `application_email_worker_secret` titkába.
4. A Supabase Vault `application_email_worker_url` értéke legyen a Production worker URL-je: `https://kekgallerost.hu/api/internal/application-email-retries`.
5. Csak a két migráció és a két Vault-titok ellenőrzése után futtasd: `select public.configure_application_email_retry_cron();`.
6. Szintetikus jelentkezéssel ellenőrizd a `cron.job_run_details`, az `email_logs`, az `email_delivery_attempts` és az adminfelület állapotait, majd töröld a tesztadatokat.

A jelenlegi Vercel Hobby cron csak naponta egyszer futtatható, ezért a percenkénti feldolgozót a Supabase `pg_cron` és `pg_net` indítja. A migrációk szándékosan nem konfigurálják és nem aktiválják automatikusan a cron jobot.

## Rollback

Először állítsd le az ütemezést: `select cron.unschedule('application-email-retry-worker');`. Ezután az alkalmazáskód visszaállítható. Az új oszlopok és az `email_delivery_attempts` tábla megtarthatók; eltávolításuk adatvesztést okozna, ezért csak külön, ellenőrzött adatmegőrzési döntéssel törölhetők.
