# Jelentkezesi, adatvedelmi es e-mail folyamat

Ez a dokumentum az indulo mukodesi donteseket rogzi.

## Publikus allasok

- Allaslista: `/allasok`
- Allas adatlap: `/allas/[slug]`
- Csak `published` statuszu allas jelenhet meg publikusan.
- A jelentkezes az adott allashoz kapcsolodik.

## Jelentkezesi adatfolyam

A jelentkezo adatai az `applications` tablaba kerulnek:

- nev
- e-mail cim
- telefonszam
- uzenet
- forras
- adatkezelesi hozzajarulas
- jelentkezesi statusz

Az allashoz tartozo egyedi kerdesek valaszai az `application_answers` tablaba kerulnek.

Feltoltott fajlok metaadatai az `uploaded_files` tablaba kerulnek. A tenyleges fajlok kesobb Supabase Storage-ban, private bucketben tarolandoak.

## Adatvedelmi alapelvek

- Jelentkezest csak adatkezelesi hozzajarulassal fogadunk.
- A service role kulcs csak szerveroldalon hasznalhato.
- Partner csak a sajat cegehez tartozo jelentkezeseket lathatja.
- Admin minden jelentkezest lathat.
- Feltoltott fajlok ne legyenek publikus bucketben.
- Torlesi es export igenyekhez kesobb admin folyamatot kell kialakitani.

## E-mail esemenyek

Resend kuldi az automatikus e-maileket.

Indulo esemenyek:

- uj jelentkezes erkezett adminnak vagy partnernek
- jelentkezesi visszaigazolas a jelentkezonek
- partner meghivasa
- jelszobeallitas vagy bejelentkezesi link
- statuszvaltozas ertesites

Minden kuldes naplozando az `email_logs` tablaban:

- cimzett
- targy
- sablon kulcs
- provider message id
- statusz
- hiba uzenet, ha van

## Felado

Default felado:

```text
Kekgalleros.hu <info@kekgallerost.hu>
```

Ez csak akkor hasznalhato eles kuldesre, ha a domain Resendben verified.

## Kovetkezo implementacios lepesek

1. Jelentkezesi urlap server action vagy route handler alapon.
2. Jelentkezes letrehozasa Supabase-ben.
3. Jelentkezesi valaszok mentese.
4. E-mail kuldes Resenddel.
5. E-mail log mentese `email_logs` tablaba.
6. Admin es partner listanezetek kialakitasa.