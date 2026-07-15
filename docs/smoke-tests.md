# Smoke testek

Ezek az endpointok az alap technikai beallitas ellenorzesere valok.

## Health check

Publikus endpoint:

```text
GET /api/health
```

Ellenorzi:

- Supabase URL be van-e allitva
- Supabase anon / publishable key be van-e allitva
- Supabase service role key be van-e allitva
- Resend API key be van-e allitva
- EMAIL_FROM be van-e allitva
- SITE URL be van-e allitva
- a `jobs` tabla elerheto-e Supabase REST-en keresztul

Nem ad vissza titkos kulcsot, csak `true` / `false` statuszt.

Varhato sikeres valasz:

```json
{
  "ok": true,
  "service": "kekgallerost-web"
}
```

Ha `ok: false`, akkor valamelyik env vagy Supabase kapcsolat hianyzik.

## Resend email smoke test

Vedett endpoint:

```text
POST /api/email/smoke
```

Szukseges Vercel env valtozok:

```env
RESEND_API_KEY=
EMAIL_FROM=Kekgalleros.hu <info@kekgallerost.hu>
EMAIL_TEST_TOKEN=
EMAIL_TEST_TO=info@kekgallerost.hu
```

A `EMAIL_TEST_TOKEN` legyen egy hosszu, veletlenszeru titok. Ne keruljon GitHubra.

Peldahivas:

```bash
curl -X POST https://kekgallerost.hu/api/email/smoke \
  -H "Authorization: Bearer <EMAIL_TEST_TOKEN>"
```

Siker eseten Resend elkuld egy teszt e-mailt az `EMAIL_TEST_TO` cimre. Ha `EMAIL_TEST_TO` nincs beallitva, akkor az `EMAIL_FROM` e-mail cimet hasznalja cimzettnek.

## Biztonsag

- A health endpoint nem ad ki titkot.
- Az email smoke endpoint nem mukodik `EMAIL_TEST_TOKEN` nelkul.
- A teszt endpointot kesobb eltavolithatjuk, ha mar van rendes e-mail kuldesi workflow.