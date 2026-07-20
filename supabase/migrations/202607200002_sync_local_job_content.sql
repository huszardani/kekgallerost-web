-- Make the centrally managed Fuvarszervező vacancy match the approved local reference content.
update public.companies
set description = 'Stabil, ellenőrzött fuvarozási partner Nagytarcsán. A csapat belföldi és nemzetközi fuvarokat szervez, átlátható operációval, tiszta felelősségi körökkel és támogató szakmai vezetéssel.',
    updated_at = now()
where slug = 'ellenorzott-fuvarozasi-partner';

update public.jobs
set short_description = 'Irodai fuvarszervezői szerep azoknak, akik szeretik a rendszert, a tempót és a tiszta felelősségi köröket.',
    summary = 'Irodai fuvarszervezői munka Nagytarcsán, stabil fix bérrel és bónuszlehetőséggel.',
    location = '2142 Nagytarcsa, Naplás út 1.',
    city = 'Nagytarcsa',
    workplace_address = '2142 Nagytarcsa, Naplás út 1.',
    category = 'Fuvarszervezés és logisztika',
    employer_label = 'Ellenőrzött munkáltató',
    employment_type = 'Teljes munkaidős, irodai pozíció',
    employment_fraction = 'Teljes munkaidő',
    work_mode = 'Irodai',
    work_schedule = 'hétfő–péntek',
    start_date_text = 'Megegyezés szerint',
    salary_display_mode = 'text',
    salary_text = 'Átlag ~650 000 Ft/hó fix + bónusz',
    intro_text = 'Fuvarszervezés és logisztika',
    compensation_details = 'Fix bér + célprémium / bónusz, egyeztetés szerinti részletekkel.',
    schedule_details = 'Teljes munkaidő, hétfőtől péntekig, irodai jelenléttel.',
    workplace_details = '2142 Nagytarcsa, Naplás út 1. A napi bejárás szükséges; saját autó előny.',
    selection_process = 'A jelentkezés áttekintése után telefonos egyeztetés, majd személyes szakmai beszélgetés következik.',
    closing_cta = 'Ha szereted a rendszert, a tempót és a tiszta felelősségi köröket, jelentkezz most!',
    hero_image_url = '/assets/job-fuvarszervezo-nagytarcsa-custom.png',
    hero_image_alt = 'Fuvarszervező logisztikai irodában útvonalakat és kapacitásokat egyeztet',
    social_image_url = '/assets/job-fuvarszervezo-nagytarcsa-custom.png',
    updated_at = now()
where slug = 'fuvarszervezo-nagytarcsa';

insert into public.job_content_blocks (job_id, block_type, eyebrow, title, body, is_visible, sort_order)
select job.id, seeded.block_type, seeded.eyebrow, seeded.title, seeded.body, true, seeded.sort_order
from public.jobs job
cross join (values
  ('intro', 'Fuvarszervezés és logisztika', 'Fuvarszervező', 'Irodai fuvarszervezői szerep azoknak, akik szeretik a rendszert, a tempót és a tiszta felelősségi köröket.', 10),
  ('role', 'A munkakör', 'Mit csinál egy fuvarszervező?', 'A fuvarszervező a napi szállítási operáció kapcsolati pontja: összehangolja a fuvarokat, a járműkapacitást, a sofőröket, az ügyfeleket és a határidőket, hogy a szállítás időben és rendezett kommunikációval fusson végig.', 20),
  ('fit', 'Illeszkedés', 'Neked való lehet, ha...', 'Röviden összeszedtük, mikor passzolhat hozzád ez a munka, és mikor érdemes inkább másik állást nézni.', 30),
  ('tasks', 'Feladatok', 'Mit fogsz csinálni?', 'A napi munkádban ezekkel a feladatokkal fogsz találkozni.', 40),
  ('requirements', 'Elvárások', 'Amit kérünk', null, 50),
  ('benefits', 'Amit adunk', 'Amit kínálunk', null, 60),
  ('advantages', 'Előnyt jelent', 'Előnyt jelent', null, 70),
  ('compensation', 'Bér és juttatások', 'Átlag ~650 000 Ft/hó', 'Fix bér + célprémium / bónusz, egyeztetés szerinti részletekkel.', 80),
  ('schedule', 'Gyors döntési adatok', 'Legfontosabb tudnivalók még egyszer', 'A legfontosabb információk egy helyen, hogy gyorsan el tudd dönteni, érdekel-e.', 90),
  ('process', 'Jelentkezési folyamat', 'Hogyan történik a jelentkezés?', 'A jelentkezés áttekintése után telefonos egyeztetés, majd személyes szakmai beszélgetés következik.', 100),
  ('company', 'A cégről', 'Ellenőrzött fuvarozási partner', null, 110),
  ('faq', 'Mini GYIK', 'Gyakori kérdések', null, 120),
  ('closing', 'Jelentkezés', 'Jelentkezz és változtass', 'Add meg az adataidat, válaszolj néhány rövid kérdésre, és a jelentkezésed automatikusan ehhez az álláshoz kapcsolódik.', 130)
) as seeded(block_type, eyebrow, title, body, sort_order)
where job.slug = 'fuvarszervezo-nagytarcsa'
on conflict (job_id, block_type) do update
set eyebrow = excluded.eyebrow, title = excluded.title, body = excluded.body,
    is_visible = true, sort_order = excluded.sort_order, updated_at = now();

delete from public.job_content_items item
using public.job_content_blocks block, public.jobs job
where item.block_id = block.id
  and block.job_id = job.id
  and job.slug = 'fuvarszervezo-nagytarcsa';

insert into public.job_content_items (block_id, item_type, title, body, sort_order)
select block.id, seeded.item_type, seeded.title, seeded.body, seeded.sort_order
from (values
  ('intro','highlight',null,'Minimum 2 év fuvarszervezési tapasztalat',10),
  ('intro','highlight',null,'Valódi döntési jogkör',20),
  ('intro','highlight',null,'Irodai jelenlét Nagytarcsán',30),

  ('role','bullet',null,'Fuvarokat szervez és követ: ajánlatkérés, kapacitáslekötés, fuvarmegbízás, státusz.',10),
  ('role','bullet',null,'Telefonon és rendszerben egyeztet ügyfelekkel, sofőrökkel és alvállalkozókkal.',20),
  ('role','bullet',null,'Figyeli az útvonalakat, időablakokat, rakodási időket és a váratlan változásokat.',30),
  ('role','bullet',null,'Irodai munka, de pörgős: gyors döntések, pontos utánkövetés és sok kommunikáció.',40),
  ('role','bullet',null,'A jó benne: azonnal látszik a munkád eredménye, felelősséged van, és rendszerben dolgozhatsz.',50),

  ('fit','bullet','Neked való lehet, ha','Legalább 2 éve dolgozol fuvarszervezőként vagy nagyon hasonló logisztikai szerepben.',10),
  ('fit','bullet','Neked való lehet, ha','Magabiztosan egyeztetsz ügyfelekkel, sofőrökkel és alvállalkozókkal.',20),
  ('fit','bullet','Neked való lehet, ha','Szereted a TERV – VÉGREHAJTÁS – KONTROLL típusú, fegyelmezett működést.',30),
  ('fit','bullet','Neked való lehet, ha','Gyorsan priorizálsz, és nem hagysz nyitott végeket.',40),
  ('fit','bullet','Neked való lehet, ha','Motivál, ha a döntéseid időben, költségben és minőségben is látszanak.',50),
  ('fit','bullet','Nem biztos, hogy neked való, ha','Nincs releváns fuvarszervezési múltad.',60),
  ('fit','bullet','Nem biztos, hogy neked való, ha','Nem vállalható számodra a napi irodai jelenlét Nagytarcsán.',70),
  ('fit','bullet','Nem biztos, hogy neked való, ha','Nem szereted a gyors helyzetkezelést és a több szereplős kommunikációt.',80),
  ('fit','bullet','Nem biztos, hogy neked való, ha','A bejárás Nagytarcsára nem megoldható.',90),

  ('tasks','bullet',null,'Belföldi és nemzetközi fuvarok szervezése, ajánlatkérés és kapacitáslekötés.',10),
  ('tasks','bullet',null,'Fuvarmegbízások kiadása, útvonalak, időablakok és rakodási idők egyeztetése.',20),
  ('tasks','bullet',null,'Ügyfél-, sofőr- és alvállalkozói kommunikáció rövid, tiszta visszajelzésekkel.',30),
  ('tasks','bullet',null,'CMR és kísérő okmányok, engedélyek, státuszok és visszajelentések kezelése.',40),
  ('tasks','bullet',null,'Kihasználtság, költség és idő optimalizálása, alternatívák szervezése váratlan helyzetben.',50),
  ('tasks','bullet',null,'Reklamációk, késések, meghibásodások és eszkalációk operatív kezelése.',60),

  ('requirements','bullet',null,'Minimum 2 év fuvarszervezési tapasztalat.',10),
  ('requirements','bullet',null,'Belföldi fuvarokban biztos rutin, nemzetközi tapasztalat előny.',20),
  ('requirements','bullet',null,'Erős szervezői készség: tervezés, ütemezés, priorizálás, kontroll.',30),
  ('requirements','bullet',null,'Magabiztos, tárgyszerű kommunikáció ügyféllel, sofőrrel és partnerrel.',40),
  ('requirements','bullet',null,'Irodai jelenlét vállalása Nagytarcsán, saját autó előny.',50),

  ('advantages','bullet',null,'Nemzetközi fuvarozási tapasztalat.',10),
  ('advantages','bullet',null,'Kapacitás-optimalizálásban és költségkontrollban szerzett rutin.',20),
  ('advantages','bullet',null,'Rendszerszemlélet, pontos utánkövetés és checklistes működés.',30),
  ('advantages','bullet',null,'Reklamációk kezelésében szerzett tapasztalat.',40),

  ('benefits','bullet',null,'Vegyes díjazás: stabil fix + célprémium / bónusz.',10),
  ('benefits','bullet',null,'Átlagosan ~650 000 Ft havi jövedelem.',20),
  ('benefits','bullet',null,'Átlátható célokhoz kötött bónuszrendszer.',30),
  ('benefits','bullet',null,'Első kifizetés az első naptári hónapban.',40),
  ('benefits','bullet',null,'Támogató, de következetes szakmai vezetés Erdélyi Lászlóval.',50),

  ('compensation','bullet',null,'Stabil fix rész.',10),
  ('compensation','bullet',null,'Mérhető célokhoz kötött bónusz.',20),
  ('compensation','bullet',null,'Első kifizetés az első naptári hónapban.',30),
  ('compensation','bullet',null,'Teljes munkaidős irodai pozíció.',40),

  ('schedule','fact','Helyszín','2142 Nagytarcsa, Naplás út 1.',10),
  ('schedule','fact','Munkarend','Teljes munkaidő, hétfő–péntek, irodai jelenléttel.',20),
  ('schedule','fact','Kezdés','Megegyezés szerint.',30),
  ('schedule','fact','Bejárás','Saját autó előny.',40),
  ('schedule','fact','Szerződés','Teljes munkaidős, irodai pozíció.',50),
  ('schedule','fact','Munkáltató','Ellenőrzött munkáltató.',60),

  ('faq','faq','Kell nemzetközi tapasztalat?','Nem kötelező, de előny. A rendszerszemlélet és a stabil fuvarszervezői alap fontosabb.',10),
  ('faq','faq','Van home office?','A pozíció irodai, mert a napi operációhoz gyors együttműködés és helyzetkezelés kell.',20),
  ('faq','faq','Mikor érkezik az első kifizetés?','Az első naptári hónapban.',30),
  ('faq','faq','Van betanítás?','Igen, a saját folyamatokra kapsz betanítást, tapasztalt fuvarszervezőként gyors beilleszkedéssel.',40),
  ('faq','faq','Mikor nem érdemes jelentkezni?','Ha nincs releváns fuvarszervezési vagy hasonló logisztikai tapasztalatod, vagy a nagytarcsai irodai jelenlét nem megoldható.',50),
  ('faq','faq','Kivel fogok dolgozni?','A közvetlen felettes Erdélyi László, aki 20 éve dolgozik a fuvarszakmában, egyenes elvárásokkal és támogató működéssel.',60)
) as seeded(block_type, item_type, title, body, sort_order)
join public.jobs job on job.slug = 'fuvarszervezo-nagytarcsa'
join public.job_content_blocks block on block.job_id = job.id and block.block_type = seeded.block_type;
