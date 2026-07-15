# DNS és e-mail beállítások

Domain: `kekgallerost.hu`

Ez a fájl a később kézzel beállítandó DNS rekordokat írja le. A pontos értékeket mindig az adott szolgáltató felülete adja meg, ezért itt a rekordtípusok és célok szerepelnek.

## Vercel domain

Vercel projekt neve: `kekgallerost-web`

Ajánlott beállítás:

| Host | Típus | Érték | Cél |
| --- | --- | --- | --- |
| `@` | `A` | Vercel által megadott apex IP | `https://kekgallerost.hu` |
| `www` | `CNAME` | Vercel által megadott cél, tipikusan `cname.vercel-dns.com` | `https://www.kekgallerost.hu` |

Vercelben állítsd be:

- Primary domain: `kekgallerost.hu`
- Redirect: `www.kekgallerost.hu` -> `kekgallerost.hu`
- Environment variable: `NEXT_PUBLIC_SITE_URL=https://kekgallerost.hu`

## Resend domain verification

Küldő e-mail: `info@kekgallerost.hu`

Resendben add hozzá a domaint:

- Domain: `kekgallerost.hu`
- From address: `info@kekgallerost.hu`

A Resend jellemzően ilyen rekordokat kér:

| Host | Típus | Érték | Cél |
| --- | --- | --- | --- |
| Resend által megadott DKIM host | `CNAME` vagy `TXT` | Resend által megadott érték | Domain verification és DKIM |
| opcionális bounce/return-path host | `CNAME` | Resend által megadott érték | jobb kézbesíthetőség |

A pontos DKIM host és value csak a Resend felületén derül ki, ne találjuk ki kézzel.

## SPF

Ha a domainen még nincs SPF rekord:

| Host | Típus | Érték |
| --- | --- | --- |
| `@` | `TXT` | `v=spf1 include:amazonses.com ~all` |

Ha már van SPF rekord, ne hozz létre másodikat. A meglévő rekordba kell beilleszteni a Resend által kért include értéket.

## DKIM

DKIM-et a Resend domain verification adja. A Resend felületéről másold át pontosan a megadott rekordokat.

## DMARC

Induló, megfigyelő beállítás:

| Host | Típus | Érték |
| --- | --- | --- |
| `_dmarc` | `TXT` | `v=DMARC1; p=none; rua=mailto:info@kekgallerost.hu; adkim=s; aspf=s` |

Élesítés után fokozatosan szigorítható:

- `p=quarantine`
- később `p=reject`

## Ellenőrzés

DNS módosítás után ellenőrizd:

- Vercel domain státusz: Valid / Configured
- Resend domain státusz: Verified
- SPF: pontosan egy SPF TXT rekord legyen a root domainen
- DKIM: minden Resend által kért rekord valid
- DMARC: `_dmarc.kekgallerost.hu` TXT rekord elérhető
