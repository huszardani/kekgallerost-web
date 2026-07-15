# Resend beallitas

Cel: automatikus e-mailek kuldese a Kekgallerost.hu rendszerbol.

Tipikus e-mail esemenyek:

- uj jelentkezo erkezett
- partner meghivasa
- jelszobeallitas
- jelentkezesi visszaigazolas
- statuszvaltozas

## 1. Domain hozzaadasa Resendben

Resend Dashboard:

```text
Domains -> Add Domain
```

Domain indulashoz:

```text
kekgallerost.hu
```

Kesobb megfontolhato kulon kuldo aldomain is:

```text
mail.kekgallerost.hu
send.kekgallerost.hu
```

Az egyszeru indulasnal a gyokerdomain is megfelel, ha nincs konfliktus mas levelezesi rendszerrel.

## 2. DNS rekordok

A Resend altal megjelenitett rekordokat pontosan kell atmasolni a domain DNS-kezelojebe.

Tipikus rekordok:

- DKIM rekord
- SPF rekord vagy SPF kiegeszites
- Return-Path / MAIL FROM rekord
- opcionalis tracking CNAME rekord

Fontos: ne talalj ki sajat ertekeket. Mindig a Resendben megjeleno host/type/value adatokat kell masolni.

## 3. Domain ellenorzese

Resendben:

```text
Verify DNS Records
```

Varhato statuszok:

```text
Pending
Verified
```

A DNS ellenorzes aszinkron, ezert a Pending allapot normalis lehet rovid ideig.

## 4. API kulcs letrehozasa

Resend:

```text
API Keys -> Create API Key
```

Nev:

```text
Kekgallerost Production
```

Jogosultsag:

```text
Sending access
```

A kulcs altalaban csak egyszer latszik teljes egeszeben. Ne keruljon GitHubra es ne legyen NEXT_PUBLIC valtozo.

## 5. Env valtozok

Lokalisan .env.local:

```env
RESEND_API_KEY=
EMAIL_FROM=Kekgalleros.hu <info@kekgallerost.hu>
```

Vercelben:

```text
Project -> Settings -> Environment Variables
```

Add hozza:

```env
RESEND_API_KEY=
EMAIL_FROM=Kekgalleros.hu <info@kekgallerost.hu>
```

A RESEND_API_KEY csak szerveroldalon hasznalhato.

## 6. Felado

Eles kuldesnel a from mezonek hitelesitett domainhez kell tartoznia.

Projekt default:

```text
Kekgalleros.hu <info@kekgallerost.hu>
```

A Resend tud kuldeni olyan cimrol is, amelyhez nincs kulon postafiok, ha a domain hitelesitve van. Valaszokat csak akkor lehet fogadni, ha az info@kekgallerost.hu tenyleges postaladakent is be van allitva egy levelezesi szolgaltatonal.

## 7. Vercel redeploy

Env modositas utan kell uj deploy:

```text
Vercel -> Deployments -> Redeploy
```

vagy uj GitHub push.

## 8. Statusz

A kodoldali Resend helper kesz:

- src/lib/email/resend.ts
- src/lib/env.ts
- .env.example

A dashboard, DNS es API key lepesek kezi beavatkozast igenyelnek, ha nincs automatizalhato hozzaferes a Resend es DNS fiokhoz.