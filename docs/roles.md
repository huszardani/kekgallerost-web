# Jogosultsági modell

A projekt induló szerepkörei:

## admin

Teljes rendszeradminisztrátori szerep.

- Cégek létrehozása, szerkesztése, inaktiválása.
- Partner profilok létrehozása és céghez rendelése.
- Minden álláshirdetés kezelése.
- Minden jelentkezés és feltöltött fájl megtekintése.
- E-mail naplók és rendszerállapot ellenőrzése.
- Később: audit logok, riportok, jogosultságkezelés.

## partner

Céghez kötött felhasználó.

- Csak a saját `company_id` alá tartozó állások kezelése.
- Csak a saját cég állásaira érkezett jelentkezések megtekintése.
- Jelentkezések státuszának frissítése.
- Saját céghez tartozó e-mail naplók olvasása.
- Nem fér hozzá más cégek adataihoz, felhasználóihoz vagy rendszeradmin beállításokhoz.

## Technikai alap

- A Supabase Auth kezeli a bejelentkezést.
- A `profiles` tábla köti össze az `auth.users` rekordot a szerepkörrel és opcionálisan a céggel.
- Az `admin` szerephez nem kötelező `company_id`.
- A `partner` szerephez kötelező `company_id`.
- A migration RLS policy-kat tartalmaz az admin és partner hozzáférések első védelmi rétegéhez.
- A service role kulcsot csak szerveroldali kódban szabad használni, kliensoldalra soha nem kerülhet.

## Ajánlott következő lépések

1. Supabase Auth e-mail login bekapcsolása.
2. Admin bootstrap folyamat létrehozása, amely az első admin profilt service role-lal hozza létre.
3. Partner meghívási folyamat kialakítása.
4. Admin és partner route guard middleware bevezetése.
5. Jelentkezéskezelési audit log hozzáadása státuszváltásokhoz.
