# Jelentkezési e-mailek tartós újrapróbálása

Az alkalmazás a sikeresen elmentett jelentkezés után három, egymástól független sort hoz létre az `email_logs` táblában: jelentkező, admin és partner. Az első küldési kísérlet az API-kérésben indul, de hibája nem változtatja meg a jelentkezés sikeres HTTP-válaszát.

Az újrapróbálási rend: 5 perc, 30 perc, majd 2 óra. A kezdeti kísérlettel együtt legfeljebb négy Resend-hívás történhet. A `delivery_key` minden próbálkozásnál változatlan; az adatbázis egyedi indexe és az atomi claim védi a párhuzamos, ismételt küldéstől. A projektben rögzített Resend SDK (4.0.1) nem támogat idempotency-key opciót, ezért szolgáltatói kulcsot a kód nem állít be.

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
