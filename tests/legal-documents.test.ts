import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const legalHtml = read("public/jogi-dokumentumok/index.html");
const legalCss = read("public/jogi-dokumentumok/legal.css");

const publicDocuments = [
  "impresszum",
  "aszf",
  "adatkezelesi-tajekoztato",
  "sutikezelesi-tajekoztato",
] as const;

test("the legal page uses the canonical root-relative stylesheet path", () => {
  assert.match(
    legalHtml,
    /<link rel="stylesheet" href="\/jogi-dokumentumok\/legal\.css">/,
  );
  assert.doesNotMatch(legalHtml, /<link rel="stylesheet" href="legal\.css">/);
  assert.equal(
    new URL(
      "/jogi-dokumentumok/legal.css",
      "https://kekgallerost.hu/jogi-dokumentumok",
    ).pathname,
    "/jogi-dokumentumok/legal.css",
  );
});

const footerFiles = [
  "public/index.html",
  "public/allasok/index.html",
  "public/allasok/fuvarszervezo-nagytarcsa/index.html",
  "public/allasok/karbantarto-gyor/index.html",
  "public/allasok/operator-szekesfehervar/index.html",
  "public/allasok/raktari-komissiozo-gyal/index.html",
  "public/allasok/reszletek/index.html",
  "public/allasok/sofor-budapest/index.html",
  "public/allasok/targoncavezeto-tatabanya/index.html",
  "public/allasok/vendeglatas-balaton/index.html",
  "src/app/_components/public-site-frame.tsx",
] as const;

test("a jogi oldal stabil útvonalon elérhető és a négy dokumentum sorrendje helyes", () => {
  const nextConfig = read("next.config.ts");
  assert.match(nextConfig, /source:\s*"\/jogi-dokumentumok"[\s\S]*destination:\s*"\/jogi-dokumentumok\/index\.html"/);

  const positions = publicDocuments.map((id) => legalHtml.indexOf(`<article class="legal-document" id="${id}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.equal((legalHtml.match(/<article class="legal-document"/g) ?? []).length, 4);
});

test("a tartalomjegyzék minden linkje egyetlen létező célpontra mutat", () => {
  const toc = legalHtml.match(/<nav class="legal-toc"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(toc, "A tartalomjegyzék nem található.");
  const hrefs = [...toc.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  assert.ok(hrefs.length > 4, "A tartalomjegyzékből hiányoznak az alfejezetek.");

  const ids = [...legalHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  for (const href of hrefs) {
    assert.equal(ids.filter((id) => id === href).length, 1, `Hibás anchor: #${href}`);
  }
});

test("nincs duplikált HTML-azonosító és a címsorhierarchia szemantikus", () => {
  const ids = [...legalHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(legalHtml, /<main id="legal-content">/);
  assert.match(legalHtml, /<nav class="legal-toc"[^>]*aria-label="Jogi dokumentumok tartalomjegyzéke"/);
  assert.equal((legalHtml.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((legalHtml.match(/<h2 id="(?:impresszum|aszf|adatkezelesi-tajekoztato|sutikezelesi-tajekoztato)-title"/g) ?? []).length, 4);
  assert.match(legalHtml, /<thead><tr><th scope="col">/);
  assert.match(legalHtml, /<tbody>/);
});

test("belső fejezet, helyőrző és szerkesztői megjegyzés nem került ki", () => {
  const forbidden = [
    "5. MUNKÁLTATÓI ADATFELDOLGOZÁSI MEGÁLLAPODÁS",
    "6. ÁLLÁSPÁLYÁZÓI ADATKEZELÉSI TÁJÉKOZTATÓ SABLON",
    "7. MEGRENDELŐLAP ÉS EGYEDI SZOLGÁLTATÁSI MEGÁLLAPODÁS",
    "8. WEBOLDALI KÖZZÉTÉTELI",
    "9. ÉLESÍTÉS ELŐTTI BELSŐ",
    "10. FŐ JOGFORRÁSOK",
    "[MUNKÁLTATÓ NEVE]",
    "Közzétételi feltétel",
    "aláírás helye",
  ];
  for (const text of forbidden) {
    assert.doesNotMatch(legalHtml, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("a jogi oldal UTF-8 szövege nem tartalmaz karakterkódolási maradványt", () => {
  assert.match(legalHtml, /Kékgallérost\.hu/);
  assert.match(legalHtml, /ÁLTALÁNOS SZERZŐDÉSI FELTÉTELEK/);
  assert.match(legalHtml, /SÜTIKEZELÉSI TÁJÉKOZTATÓ/);
  assert.doesNotMatch(legalHtml + legalCss, /Ă|Ĺ|Å|Ä|â€|�/);
});

test("a sütitájékoztató csak a tényleges technológiákat állítja aktívnak", () => {
  assert.match(legalHtml, /Supabase hitelesítési munkamenet/);
  assert.match(legalHtml, /jelenleg nincs telepítve Google Analytics vagy Google Ads/);
  assert.match(legalHtml, /jelenleg nincs telepítve Meta Pixel/);
  assert.doesNotMatch(legalHtml, /_ga(?:_|<|\s)|_gcl_au|_fbp|_fbc|kekgallerost_cookie_consent/);
});

test("minden nyilvános lábléc a négy kanonikus jogi anchorra mutat", () => {
  for (const file of footerFiles) {
    const source = read(file);
    for (const id of publicDocuments) {
      assert.match(source, new RegExp(`/jogi-dokumentumok#${id}`), `${file}: #${id}`);
    }
    assert.doesNotMatch(source, /jogi-dokumentumok(?:\/index\.html)?#(?:adatkezeles|cookie)(?=["'])/);
  }
});

test("a mobil- és nyomtatási stílus nem okoz dokumentumszintű vízszintes túlcsordulást", () => {
  assert.match(legalCss, /body\.legal-page[\s\S]*overflow-x:\s*hidden/);
  assert.match(legalCss, /\.legal-table-wrap[\s\S]*overflow-x:\s*auto/);
  assert.match(legalCss, /max-width:\s*100%/);
  assert.match(legalCss, /@media \(max-width:\s*780px\)/);
  assert.match(legalCss, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(legalCss, /scroll-margin-top:/);
  assert.match(legalCss, /@media print/);
});
