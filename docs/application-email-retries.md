# Jelentkezési e-mailek tartós újrapróbálása

Az alkalmazás a sikeresen elmentett jelentkezés után három, egymástól független sort hoz létre az `email_logs` táblában: jelentkező, admin és partner. Az első küldési kísérlet az API-kérésben indul, de hibája nem változtatja meg a jelentkezés sikeres HTTP-válaszát.

Az újrapróbálási rend: az első hiba után 5 perc, a második után 30 perc. Egy értesítéshez legfeljebb három automatikus kísérlet tartozik. A `delivery_key` minden próbálkozásnál változatlan; az adatbázis részleges egyedi indexe és az atomi claim védi a párhuzamos feldolgozástól. Ugyanez a kulcs kerül a Resend `Idempotency-Key` fejlécébe, ezért a szolgáltatói siker utáni adatbázishiba újrapróbálása sem küld újabb példányt.

A jelentkezés már a saját tartós sorában rögzíti az e-mail-kézbesítési igényt. Ha a kezdeti queue-létrehozás hibázik, a következő worker-futás ebből újra létrehozza a hiányzó címzetti sorokat.

## Production aktiválás – külön jóváhagyással

1. Alkalmazd a `202608110001_application_email_delivery_retries.sql` migrációt.
2. Hozz létre egy legalább 32 bájtos véletlen titkot. Ugyanaz az érték kerüljön:
   - a Vercel Production `APPLICATION_EMAIL_RETRY_SECRET` változójába;
   - a Supabase Vault `application_email_worker_secret` titkába.
3. A Supabase Vault `application_email_worker_url` értéke legyen a Production worker URL-je: `https://kekgallerost.hu/api/internal/application-email-retries`.
4. A migráció után, a két Vault-titok meglétekor futtasd: `select public.configure_application_email_retry_cron();`.
5. Ellenőrizd a `cron.job_run_details`, az `email_logs` és az `email_delivery_attempts` állapotát szintetikus adattal.

A jelenlegi Vercel Hobby cron csak naponta egyszer futtatható, ezért a percenkénti feldolgozót a Supabase `pg_cron` és `pg_net` indítja. A migráció szándékosan nem konfigurálja és nem aktiválja automatikusan a cron jobot.

## Rollback

Először állítsd le az ütemezést: `select cron.unschedule('application-email-retry-worker');`. Ezután az alkalmazáskód visszaállítható. Az új oszlopok és az `email_delivery_attempts` tábla megtarthatók; eltávolításuk adatvesztést okozna, ezért csak külön, ellenőrzött adatmegőrzési döntéssel törölhetők.
