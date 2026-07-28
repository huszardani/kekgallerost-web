import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  legacyJobRedirects,
  resolveLegacyJobRequest,
  retiredLegacyJobSlugs
} from "../src/lib/legacy-job-routes.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("a bizonyított régi állás-URL közvetlenül az új oldalra irányít", () => {
  for (const [slug, destination] of Object.entries(legacyJobRedirects)) {
    assert.deepEqual(resolveLegacyJobRequest(`/allasok/${slug}`, new URLSearchParams()), {
      kind: "redirect",
      destination
    });
    assert.deepEqual(resolveLegacyJobRequest(`/allasok/${slug}/`, new URLSearchParams()), {
      kind: "redirect",
      destination
    });
    assert.deepEqual(resolveLegacyJobRequest(`/allasok/${slug}/index.html`, new URLSearchParams()), {
      kind: "redirect",
      destination
    });
  }
});

test("az UTM paraméterek a közvetlen és a korábbi részletek URL-en is megmaradnak", () => {
  const direct = resolveLegacyJobRequest(
    "/allasok/fuvarszervezo-nagytarcsa",
    new URLSearchParams("utm_source=teszt&utm_campaign=regi")
  );
  assert.deepEqual(direct, {
    kind: "redirect",
    destination: "/allas/fuvarszervezo-nagytarcsa?utm_source=teszt&utm_campaign=regi"
  });

  const generic = resolveLegacyJobRequest(
    "/allasok/reszletek",
    new URLSearchParams("allas=fuvarszervezo-nagytarcsa&utm_source=teszt")
  );
  assert.deepEqual(generic, {
    kind: "redirect",
    destination: "/allas/fuvarszervezo-nagytarcsa?utm_source=teszt"
  });
});

test("a listaoldal érintetlen, a korábbi index URL pedig közvetlenül rá irányít", () => {
  assert.deepEqual(resolveLegacyJobRequest("/allasok", new URLSearchParams()), { kind: "pass" });
  assert.deepEqual(resolveLegacyJobRequest("/allasok/", new URLSearchParams()), { kind: "pass" });
  assert.deepEqual(
    resolveLegacyJobRequest("/allasok/index.html", new URLSearchParams("utm_source=teszt")),
    { kind: "redirect", destination: "/allasok?utm_source=teszt" }
  );
});

test("a megszűnt ismert hirdetések 410-et, az ismeretlen slug 404-et kap", () => {
  for (const slug of retiredLegacyJobSlugs) {
    assert.deepEqual(resolveLegacyJobRequest(`/allasok/${slug}`, new URLSearchParams()), { kind: "gone" });
  }
  assert.deepEqual(resolveLegacyJobRequest("/allasok/nem-letezo-allas", new URLSearchParams()), {
    kind: "not-found"
  });
});

test("az átirányítás nem hozhat létre hurkot", () => {
  for (const destination of Object.values(legacyJobRedirects)) {
    assert.equal(destination.startsWith("/allas/"), true);
    assert.equal(destination.startsWith("/allasok/"), false);
    assert.deepEqual(resolveLegacyJobRequest(destination, new URLSearchParams()), { kind: "pass" });
  }
});

test("a szerver 308-as végleges átirányítást használ a statikus rewrite helyett", () => {
  const proxy = read("src/proxy.ts");
  assert.match(proxy, /NextResponse\.redirect\(new URL\(legacyRoute\.destination, request\.url\), 308\)/);
  assert.match(proxy, /status: 410/);
  assert.match(proxy, /status: 404/);
  assert.doesNotMatch(read("next.config.ts"), /destination: "\/allasok\/:slug\/index\.html"/);
  assert.match(read("next.config.ts"), /skipTrailingSlashRedirect: true/);
  assert.match(proxy, /normalizedUrl\.pathname = normalizedUrl\.pathname\.slice\(0, -1\)/);
});

test("a publikus álláskártyák és navigációk közvetlen cél-URL-t használnak", () => {
  const files = [
    "src/app/allasok/jobs-list.tsx",
    "src/app/admin/allasok/[id]/page.tsx",
    "public/jobs-page.js",
    "public/allasok/jobs-page.js"
  ];
  assert.match(read(files[0]), /href=\{`\/allas\/\$\{job\.slug\}`\}/);
  assert.match(read(files[1]), /href=\{`\/allas\/\$\{job\.slug\}`\}/);
  assert.match(read(files[2]), /card\.href = `\/allas\//);
  assert.match(read(files[3]), /card\.href = `\/allas\//);
  for (const file of files) assert.doesNotMatch(read(file), /[`"']\/allasok\/\$\{/);
  assert.doesNotMatch(read("public/jogi-dokumentumok/index.html"), /\.\.\/allasok\/index\.html/);
});

test("az új oldal canonical és strukturált URL-je az egyes számú útvonalat használja", () => {
  assert.match(read("src/app/allas/[slug]/page.tsx"), /const canonical = `\$\{siteUrl\(\)\}\/allas\/\$\{job\.slug\}`/);
  assert.match(read("src/app/allas/[slug]/job-page.tsx"), /url: `\$\{siteUrl\(\)\}\/allas\/\$\{job\.slug\}`/);
});
