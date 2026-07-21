import Image from "next/image";
import type { ReactNode } from "react";
import PublicSiteFrame from "@/app/_components/public-site-frame";
import type { JobPageBlock, JobPageItem, JobPageView } from "@/lib/job-page";

function listItems(block?: JobPageBlock) {
  return block?.items.filter((item) => item.body.trim()) ?? [];
}

function BulletList({ items, className = "" }: { items: JobPageItem[]; className?: string }) {
  if (!items.length) return null;
  return <ul className={`kg-detail-list ${className}`.trim()}>{items.map((item, index) => <li key={item.id ?? `${item.body}-${index}`}>{item.body}</li>)}</ul>;
}



export default function JobPageTemplate({ view, application, preview = false }: { view: JobPageView; application?: ReactNode; preview?: boolean }) {
  const byType = (type: JobPageBlock["type"]) => view.blocks.find((block) => block.type === type);
  const role = byType("role") ?? byType("intro");
  const fit = byType("fit");
  const tasks = byType("tasks");
  const requirements = byType("requirements");
  const advantages = byType("advantages");
  const benefits = byType("benefits");
  const process = byType("process");
  const faq = byType("faq");
  const roleItems = listItems(role).filter((item) => item.itemType !== "highlight");
  const fitItems = listItems(fit);
  const positiveFit = fitItems.filter((item) => !item.title || !item.title.toLocaleLowerCase("hu").includes("nem"));
  const negativeFit = fitItems.filter((item) => item.title?.toLocaleLowerCase("hu").includes("nem"));

  const galleryRole = view.gallery[0];
  const galleryTasks = view.gallery[1] ?? view.gallery[0];

  return (
    <div className={`kg-job-template kg-job-${view.slug}${preview ? " is-preview" : ""}`}>
      <PublicSiteFrame detail>
        <main>
          <section aria-labelledby="job-detail-title" className="kg-job-detail-hero">
            <div className="kg-detail-hero-copy">
              <div className="kg-detail-card-top">
                <span aria-label="Kékgallérost.hu" className="kg-job-logo-pill"><Image alt="" height={36} src="/assets/logo-mark.png" width={36} /></span>
                {view.salary ? <span className="kg-pill kg-salary-pill">{view.salary}</span> : null}
              </div>
              <h1 id="job-detail-title">{view.title || "Új állás"}</h1>
              {view.summary ? <p className="kg-detail-subtitle">{view.summary}</p> : null}
              {view.heroFacts.length ? <dl className="kg-detail-hero-facts">{view.heroFacts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : null}
              {view.heroHighlights.length ? <div className="kg-detail-hero-highlights"><strong>Fontos tudnivalók</strong><ul>{view.heroHighlights.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
              <div className="kg-detail-actions">
                <a className="kg-button kg-button-primary" href="#application">Jelentkezem erre a munkára</a>
                <a className="kg-button kg-button-light" href="#conditions">Megnézem a feltételeket</a>
              </div>
            </div>
            <figure className="kg-job-hero-image">
              {view.hero ? <Image alt={view.hero.alt || view.title} fill priority sizes="(max-width: 980px) 100vw, 45vw" src={view.hero.url} style={{ objectPosition: `${view.hero.focusX}% ${view.hero.focusY}%` }} unoptimized /> : <div className="kg-image-placeholder" />}
            </figure>
          </section>

          {role ? <section aria-labelledby="role-title" className="kg-detail-section kg-work-image-section">
            <div className="kg-work-image-layout">
              {galleryRole ? <figure className="kg-work-image-frame"><Image alt={galleryRole.alt} height={760} sizes="(max-width: 980px) 100vw, 58vw" src={galleryRole.url} style={{ objectPosition: `${galleryRole.focusX}% ${galleryRole.focusY}%` }} unoptimized width={1100} /></figure> : null}
              <div className="kg-work-image-copy">
                <p className="kg-eyebrow">Munkakör röviden</p>
                <h2 id="role-title">{role.title || `Mit csinál egy ${view.title.toLocaleLowerCase("hu")}?`}</h2>
                {role.body ? <p>{role.body}</p> : null}
                <BulletList items={roleItems} />
                <a className="kg-button kg-button-primary" href="#application">Jelentkezem</a>
              </div>
            </div>
          </section> : null}

          {view.quickFacts.length ? <section aria-labelledby="quick-facts-title" className="kg-detail-section kg-quick-facts-section">
            <div className="kg-section-heading"><p className="kg-eyebrow">Gyors döntési adatok</p><h2 id="quick-facts-title">Legfontosabb tudnivalók még egyszer</h2><p>A legfontosabb információk egy helyen, hogy gyorsan el tudd dönteni, érdekel-e.</p></div>
            <dl className="kg-quick-facts-grid">{view.quickFacts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd>{fact.detail ? <small>{fact.detail}</small> : null}</div>)}</dl>
            <div className="kg-section-cta"><a className="kg-button kg-button-primary" href="#application">Érdekel, jelentkezem</a></div>
          </section> : null}

          {fit && fitItems.length ? <section aria-labelledby="fit-title" className="kg-detail-section kg-fit-section" id="conditions">
            <div className="kg-section-heading"><p className="kg-eyebrow">Illeszkedés</p><h2>Neked való lehet, ha...</h2><p>Röviden összeszedtük, mikor passzolhat hozzád ez a munka, és mikor érdemes inkább másik állást nézni.</p></div>
            <div className="kg-fit-grid">
              {positiveFit.length ? <article className="kg-fit-card kg-fit-positive"><h3>Neked való lehet, ha</h3><BulletList items={positiveFit} /></article> : null}
              {negativeFit.length ? <article className="kg-fit-card kg-fit-warning"><h3>Nem biztos, hogy neked való, ha</h3><BulletList items={negativeFit} /></article> : null}
            </div>
          </section> : null}

          {tasks ? <section aria-labelledby="tasks-title" className="kg-detail-section kg-tasks-section">
            <div className="kg-detail-two-column">
              <article className="kg-detail-panel kg-feature-panel">
                <p className="kg-eyebrow">{tasks.eyebrow || "Feladatok"}</p><h2 id="tasks-title">{tasks.title || "Mit fogsz csinálni?"}</h2>
                {tasks.body ? <p className="kg-block-intro">{tasks.body}</p> : null}<BulletList items={listItems(tasks)} />
                <div className="kg-inline-cta"><a className="kg-button kg-button-primary" href="#application">Jelentkezem, ha passzol hozzám</a></div>
              </article>
              {galleryTasks ? <figure className="kg-task-image"><Image alt={galleryTasks.alt} height={900} sizes="(max-width: 1080px) 100vw, 40vw" src={galleryTasks.url} style={{ objectPosition: `${galleryTasks.focusX}% ${galleryTasks.focusY}%` }} unoptimized width={900} /></figure> : null}
            </div>
          </section> : null}

          {(requirements || benefits || advantages) ? <section aria-labelledby="expectations-title" className="kg-detail-section kg-expectations-section">
            <div className="kg-section-heading"><p className="kg-eyebrow">Kérünk és adunk</p><h2 id="expectations-title">Amit kérünk és amit adunk</h2></div>
            <div className="kg-three-panels">
              {requirements ? <article className="kg-detail-panel"><h3>Amit kérünk</h3><BulletList items={listItems(requirements)} /></article> : null}
              {benefits ? <article className="kg-detail-panel"><h3>Amit adunk</h3><BulletList items={listItems(benefits)} /></article> : null}
              {advantages ? <article className="kg-detail-panel"><h3>Előnyt jelent</h3><BulletList items={listItems(advantages)} /></article> : null}
            </div>
          </section> : null}


          {process ? <section aria-labelledby="process-title" className="kg-detail-section kg-process-section">
            <div className="kg-section-heading"><p className="kg-eyebrow">Jelentkezési folyamat</p><h2 id="process-title">Hogyan történik a jelentkezés?</h2></div>
            <div className="kg-application-steps">
              <article><span>1</span><div><strong>Kitöltöd a gyors jelentkezést</strong><p>Megadod az alapadataidat, és válaszolsz néhány, erre a munkára szabott kérdésre.</p></div></article>
              <article><span>2</span><div><strong>A jelentkezésed bekerül a rendszerbe</strong><p>A munkáltató egy helyen látja az adataidat, válaszaidat és a pozícióhoz kapcsolódó jelentkezésedet.</p></div></article>
              <article><span>3</span><div><strong>Telefonos egyeztetés következhet</strong><p>Ha a válaszaid alapján szóba jöhetsz, a munkáltató felveheti veled a kapcsolatot.</p></div></article>
            </div>
            <p className="kg-process-note">A jelentkezés nem jelent automatikus felvételt. A további egyeztetésről és kiválasztásról a munkáltató dönt.</p>
            <div className="kg-section-cta"><a className="kg-button kg-button-primary" href="#application">Kitöltöm a jelentkezést</a></div>
          </section> : null}


          {faq && listItems(faq).length ? <section aria-labelledby="faq-title" className="kg-detail-section kg-mini-faq-section">
            <div className="kg-section-heading"><p className="kg-eyebrow">Mini GYIK</p><h2 id="faq-title">Gyakori kérdések</h2></div>
            <div className="kg-mini-faq-grid">{listItems(faq).map((item, index) => <details key={item.id ?? index}><summary>{item.title || `Kérdés ${index + 1}`}<span aria-hidden="true">+</span></summary><p>{item.body}</p></details>)}</div>
          </section> : null}

          <section aria-labelledby="application-title" className="kg-detail-section kg-application-section" id="application">
            <div className="kg-section-heading"><p className="kg-eyebrow">Jelentkezés</p><h2 id="application-title">Jelentkezz és változtass</h2><p>Add meg az adataidat, válaszolj néhány rövid kérdésre, és a jelentkezésed automatikusan ehhez az álláshoz kapcsolódik.</p></div>
            <div className="kg-application-form-shell">{application ?? <div className="kg-preview-form"><h3>Jelentkezési űrlap</h3><p>Az éles oldalon itt jelennek meg az alapadatok, az egyedi kérdések és a fájlfeltöltés.</p><button className="kg-button kg-button-primary" disabled type="button">Jelentkezés elküldése</button></div>}</div>
          </section>
        </main>
        <a className="kg-mobile-sticky-apply" href="#application">Jelentkezem</a>
      </PublicSiteFrame>
    </div>
  );
}
