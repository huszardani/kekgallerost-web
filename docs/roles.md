# Jogosultsagi modell

A projekt indulo szerepkorei:

## admin

Teljes rendszeradminisztratori szerep.

- Cegek letrehozasa, szerkesztese, inaktivalasa.
- Partner profilok letrehozasa es ceghez rendelese.
- Minden allashirdetes kezelese.
- Minden jelentkezes es feltoltott fajl megtekintese.
- E-mail naplok es rendszerallapot ellenorzese.
- Kesobb: audit logok, riportok, jogosultsagkezeles.

## partner

Ceghez kotott felhasznalo.

- Csak a sajat `company_id` ala tartozo allasok kezelese.
- Csak a sajat ceg allasaira erkezett jelentkezesek megtekintese.
- Jelentkezesek statuszanak frissitese.
- Sajat ceghez tartozo e-mail naplok olvasasa.
- Nem fer hozza mas cegek adataihoz, felhasznaloihoz vagy rendszeradmin beallitasokhoz.

## Technikai alap

- A Supabase Auth kezeli a bejelentkezest.
- A `profiles` tabla koti ossze az `auth.users` rekordot a szerepkorrel es opcionalisan a ceggel.
- Az `admin` szerephez nem kotelezo `company_id`.
- A `partner` szerephez kotelezo `company_id`.
- A migration RLS policy-kat tartalmaz az admin es partner hozzaferesek elso vedelmi retegehez.
- A service role kulcsot csak szerveroldali kodban szabad hasznalni, kliensoldalra soha nem kerulhet.

## Kovetkezo lepesek

1. Supabase Auth e-mail login bekapcsolasa.
2. Admin bootstrap folyamat letrehozasa, amely az elso admin profilt service role-lal hozza letre.
3. Partner meghivasi folyamat kialakitasa.
4. Admin es partner route guard middleware bevezetese.
5. Jelentkezeskezelesi audit log hozzaadasa statuszvaltasokhoz.