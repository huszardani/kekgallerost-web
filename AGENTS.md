# Kékgallérost web – agent szabályok

## Munkavégzés

- Csak a feladathoz szükséges fájlokat módosítsd; őrizd meg a nem kapcsolódó felhasználói változtatásokat.
- A releváns célzott teszt után futtasd a szükséges ellenőrzéseket: `corepack pnpm run lint`, `corepack pnpm run typecheck`, `corepack pnpm run test`. Buildhez: `corepack pnpm run build`.
- Egyszerű UI-, CSS-, szöveg-, szín- vagy térközjavításnál ne refaktorálj indokolatlanul, és működésváltozás nélkül ne módosíts tesztet.
- A jogi dokumentumok szövegét csak kifejezett felhasználói kérésre módosítsd.

## GitHub és Vercel

- Kis, kész javításhoz normál (nem Draft) PR készüljön.
- Branch push és PR után a Vercel automatikusan Preview deploymentet készít; ne indíts kézi Redeployt.
- A Preview-t desktop- és mobilnézetben, HTTP-válasszal, betöltődő CSS-sel és az elérhető deployment-logokkal ellenőrizd.
- Csak akkor merge-ölj `main` ágba és ellenőrizd a Production `Ready` deploymentet, ha az aktuális prompt ezt kifejezetten engedélyezi. Más esetben a sikeres Preview-nál állj meg.
- Merge előtt állj meg, ha a változás adatbázist, jogosultságot, hitelesítést, backendet, környezeti változót, új függőséget, fizetést vagy jogi tartalmat érint.

## Biztonság és kommunikáció

- Átmeneti hálózati vagy DNS-hibánál ellenőrizd a Git-állapotot, majd ismételd meg a biztonságosan újrapróbálható műveletet. Csak valódi bejelentkezési vagy jogosultsági akadálynál kérj felhasználói parancsfuttatást.
- Rövid állapotfrissítéseket adj. A végső jelentés legfeljebb 8 sor: változtatás, tesztek, commit, PR, Preview vagy Production deployment, éles URL, esetleges probléma.
- Soha ne jeleníts meg vagy küldj tokent, jelszót, API-kulcsot vagy más titkot.
