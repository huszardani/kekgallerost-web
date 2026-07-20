import Image from "next/image";
import type { ReactNode } from "react";
import type { JobPageBlock, JobPageView } from "@/lib/job-page";

function BlockContent({ block }: { block: JobPageBlock }) {
  const items = block.items.filter((item) => item.body.trim());
  if (block.type === "faq") {
    return <div className="job-template-faq">{items.map((item, index) => <details key={item.id ?? `${item.body}-${index}`}><summary>{item.title || `Kérdés ${index + 1}`}<span aria-hidden="true">+</span></summary><p>{item.body}</p></details>)}</div>;
  }
  if (items.some((item) => item.itemType === "fact")) {
    return <div className="job-template-facts">{items.map((item, index) => <div key={item.id ?? `${item.body}-${index}`}><strong>{item.title}</strong><span>{item.body}</span></div>)}</div>;
  }
  return <>{block.body ? <div className="preline-text">{block.body}</div> : null}{items.length ? <ul className="job-template-list">{items.map((item, index) => <li key={item.id ?? `${item.body}-${index}`}>{item.title ? <strong>{item.title}: </strong> : null}{item.body}</li>)}</ul> : null}</>;
}

export default function JobPageTemplate({ view, application, preview = false }: { view: JobPageView; application?: ReactNode; preview?: boolean }) {
  const visibleBlocks = view.blocks.filter((block) => block.visible && (block.body || block.items.some((item) => item.body.trim())));
  return (
    <div className={`job-template${preview ? " is-preview" : ""}`}>
      <section className="job-template-hero">
        {view.hero ? <Image alt={view.hero.alt || view.title} className="job-template-hero-image" fill priority sizes="100vw" src={view.hero.url} style={{ objectPosition: `${view.hero.focusX}% ${view.hero.focusY}%` }} unoptimized /> : null}
        <div className="job-template-hero-shade" />
        <div className="page-shell job-template-hero-inner">
          <p className="eyebrow light">{view.intro || view.category || view.employer}</p>
          <h1>{view.title || "Új állás"}</h1>
          {view.summary ? <p className="lead light">{view.summary}</p> : null}
          <div className="job-facts">{view.facts.map((fact) => <span key={fact}>{fact}</span>)}</div>
        </div>
      </section>

      <div className="page-shell job-template-layout">
        <article className="job-template-content">
          {visibleBlocks.map((block, index) => {
            const galleryImage = view.gallery[index % Math.max(view.gallery.length, 1)];
            const mediaBlock = galleryImage && ["role", "tasks", "benefits"].includes(block.type);
            return <section className={`panel job-template-block block-${block.type}${mediaBlock ? " has-media" : ""}`} key={block.id ?? block.type}>
              {mediaBlock && galleryImage ? <Image alt={galleryImage.alt} height={720} sizes="(max-width: 820px) 100vw, 45vw" src={galleryImage.url} style={{ objectPosition: `${galleryImage.focusX}% ${galleryImage.focusY}%` }} unoptimized width={1200} /> : null}
              <div>
                {block.eyebrow ? <p className="eyebrow">{block.eyebrow}</p> : null}
                {block.title ? <h2>{block.title}</h2> : null}
                <BlockContent block={block} />
              </div>
            </section>;
          })}
        </article>
        <aside className="job-template-application" aria-label="Jelentkezés">{application ?? <div className="panel job-template-preview-form"><p className="eyebrow">Jelentkezés</p><h2>Jelentkezési űrlap</h2><p>Az éles oldalon itt jelennek meg az alapadatok, az egyedi kérdések és a fájlfeltöltés.</p><button className="button" disabled type="button">Jelentkezés elküldése</button></div>}</aside>
      </div>
    </div>
  );
}
