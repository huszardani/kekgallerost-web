import Image from "next/image";
import Link from "next/link";
import PublicSiteFrame from "@/app/_components/public-site-frame";
import { activateScheduledJobs } from "@/lib/job-data";
import { buildJobPageView } from "@/lib/job-page";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "hu"));
}

export default async function JobsListPage({ searchParams }: { searchParams?: SearchParams }) {
  await activateScheduledJobs();
  const filters = searchParams ? await searchParams : {};
  const query = param(filters.q).trim().toLocaleLowerCase("hu");
  const city = param(filters.city);
  const category = param(filters.category);
  const supabase = createPublicSupabaseClient();
  const { data: jobs, error } = await supabase.from("jobs").select("*").eq("status", "published").order("published_at", { ascending: false });
  if (error) throw new Error(error.message);

  const companyIds = [...new Set(jobs.map((job) => job.company_id))];
  const jobIds = jobs.map((job) => job.id);
  const [companiesResult, blocksResult, mediaResult] = await Promise.all([
    companyIds.length ? supabase.from("companies").select("*").in("id", companyIds) : Promise.resolve({ data: [], error: null }),
    jobIds.length ? supabase.from("job_content_blocks").select("*").in("job_id", jobIds).order("sort_order") : Promise.resolve({ data: [], error: null }),
    jobIds.length ? supabase.from("job_media").select("*").in("job_id", jobIds).order("sort_order") : Promise.resolve({ data: [], error: null })
  ]);
  if (companiesResult.error || blocksResult.error || mediaResult.error) throw new Error("Az álláslista adatai nem tölthetők be.");

  const blocks = blocksResult.data ?? [];
  const blockIds = blocks.map((block) => block.id);
  const itemsResult = blockIds.length
    ? await supabase.from("job_content_items").select("*").in("block_id", blockIds).order("sort_order")
    : { data: [], error: null };
  if (itemsResult.error) throw new Error("Az álláskártyák tartalma nem tölthető be.");

  const companies = companiesResult.data ?? [];
  const items = itemsResult.data ?? [];
  const media = mediaResult.data ?? [];
  const cards = jobs.flatMap((job) => {
    const company = companies.find((item) => item.id === job.company_id);
    if (!company) return [];
    const view = buildJobPageView({
      job,
      company,
      blocks: blocks.filter((block) => block.job_id === job.id),
      items: items.filter((item) => blocks.some((block) => block.job_id === job.id && block.id === item.block_id)),
      media: media.filter((item) => item.job_id === job.id)
    });
    return [{ job, view }];
  });
  const cities = unique(cards.map(({ job }) => job.city || job.location));
  const categories = unique(cards.map(({ job }) => job.category));
  const visibleCards = cards.filter(({ job, view }) => {
    const haystack = [job.title, view.employer, job.city, job.location, job.category, view.salary, view.summary, ...view.heroHighlights]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("hu");
    return (!query || haystack.includes(query)) && (!city || (job.city || job.location) === city) && (!category || job.category === category);
  });

  return (
    <PublicSiteFrame>
      <main>
        <section aria-labelledby="jobs-page-title" className="kg-jobs-page-hero">
          <div>
            <p className="kg-eyebrow light">/allasok</p>
            <h1 id="jobs-page-title">Fizikai munkát keresel? Nézd meg az aktuális lehetőségeket.</h1>
            <p>Az állásoknál előre látod a fontos feltételeket: bérsáv vagy fizetés, munkarend, helyszín, kezdés, bejárás és alapelvárások. Így gyorsan eldöntheted, neked való-e a munka.</p>
          </div>
          <aside aria-label="Jelentkezési logika" className="kg-jobs-page-note">
            <strong>Jelentkezés egyszerűen, felesleges körök nélkül</strong>
            <ul>
              <li><strong>Önéletrajz:</strong> nem kötelező</li>
              <li><strong>Alapadatok:</strong> név, telefon, elérhetőség</li>
              <li><strong>Rövid kérdések:</strong> kezdés, műszak, tapasztalat</li>
              <li><strong>Tapasztalat:</strong> leírhatod pár mondatban</li>
            </ul>
          </aside>
        </section>

        <section aria-label="Állásszűrők" className="kg-jobs-filter-panel">
          <form className="kg-search-form">
            <label><span>Munkakör vagy kulcsszó</span><input defaultValue={param(filters.q)} name="q" placeholder="raktár, sofőr, operátor" type="search" /></label>
            <label><span>Település</span><select defaultValue={city} name="city"><option value="">Bárhol</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label><span>Kategória</span><select defaultValue={category} name="category"><option value="">Minden kategória</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <button className="kg-button kg-button-primary" type="submit">Szűrés</button>
          </form>
        </section>

        <section aria-labelledby="active-jobs-title" className="kg-jobs-list-section" id="job-list">
          <div className="kg-jobs-toolbar">
            <div><p className="kg-eyebrow">Aktív munkák</p><h2 id="active-jobs-title">Nyitott pozíciók</h2></div>
            <p>{visibleCards.length} állás</p>
          </div>
          <div className="kg-jobs-page-grid">
            {visibleCards.map(({ job, view }) => (
              <Link aria-label={`${job.title} részletei és jelentkezés`} className="kg-job-tile" href={`/allas/${job.slug}`} key={job.id}>
                <div className="kg-job-card-top">
                  <span aria-label="Kékgallérost.hu" className="kg-job-logo-pill"><Image alt="" height={36} src="/assets/logo-mark.png" width={36} /></span>
                  {view.salary ? <span className="kg-pill kg-salary-pill">{view.salary}</span> : null}
                </div>
                <h3>{job.title}</h3>
                <p className="kg-employer-label">{view.employer === "Megbízónk" ? "Ellenőrzött munkáltató" : view.employer}</p>
                <dl className="kg-job-facts">
                  {view.heroFacts.slice(0, 4).map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
                </dl>
                {view.heroHighlights.length ? <div className="kg-card-highlights"><strong>Fontos tudnivalók</strong><ul>{view.heroHighlights.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                <span className="kg-button kg-button-primary">Részletek és jelentkezés</span>
              </Link>
            ))}
            {visibleCards.length === 0 ? <div className="kg-empty-state"><h3>Nincs a szűrésnek megfelelő állás.</h3><p>Próbálj másik keresést vagy töröld a szűrőket.</p></div> : null}
          </div>
        </section>
      </main>
    </PublicSiteFrame>
  );
}
