# DNS es e-mail beallitasok

Domain: `kekgallerost.hu`

Ez a fajl a kezzel beallitando DNS rekordokat irja le. A pontos ertekeket mindig az adott szolgaltato felulete adja meg.

## Vercel domain

Vercel projekt neve: `kekgallerost-web`

A jelenlegi ellenorzes szerint ezek elerhetok:

- `https://kekgallerost-web.vercel.app`
- `https://kekgallerost.hu`
- `https://www.kekgallerost.hu`

Altalanos rekordok:

| Host | Tipus | Ertek | Cel |
| --- | --- | --- | --- |
| `@` | `A` | Vercel altal megadott apex IP | `https://kekgallerost.hu` |
| `www` | `CNAME` | Vercel altal megadott cel | `https://www.kekgallerost.hu` |

Vercelben:

- Primary domain: `kekgallerost.hu`
- Redirect: `www.kekgallerost.hu` -> `kekgallerost.hu`, ha ezt szeretnenk elsodlegesnek
- Environment variable: `NEXT_PUBLIC_SITE_URL=https://kekgallerost.hu`

## Resend domain verification

Felado: `Kekgalleros.hu <info@kekgallerost.hu>`

Resend domain: `kekgallerost.hu`

Aktualis DNS ellenorzes szerint a Resend rekordok elerhetok:

- DKIM TXT: `resend._domainkey.kekgallerost.hu`
- SPF TXT: `send.kekgallerost.hu`
- MX / Return-Path: `send.kekgallerost.hu`
- DMARC TXT: `_dmarc.kekgallerost.hu`

## SPF

A Resend kuldeshez jelenleg a `send.kekgallerost.hu` aldomain SPF rekordja van beallitva:

```text
v=spf1 include:amazonses.com ~all
```

Ha a root domainen is lesz mas levelezes, ott csak egy SPF rekord lehet; tobb SPF TXT rekord hibat okoz.

## DKIM

DKIM-et a Resend domain verification adja. A teljes DKIM erteket mindig a Resend feluleterol kell masolni.

## DMARC

Indulo, megfigyelo beallitas:

```text
v=DMARC1; p=none;
```

Elesites utan fokozatosan szigorithato:

- `p=quarantine`
- kesobb `p=reject`

## Ellenorzes

DNS modositas utan ellenorizd:

- Vercel domain statusz: Valid / Configured
- Resend domain statusz: Verified
- SPF: pontosan egy SPF rekord legyen az adott hoston
- DKIM: Resend szerint Verified
- DMARC: `_dmarc.kekgallerost.hu` TXT rekord elerheto