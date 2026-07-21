"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useState } from "react";
import JobPageTemplate from "@/app/allas/[slug]/job-template";
import { saveJobEditorAction } from "@/app/admin/crm-actions";
import type { JobPageBlock, JobPageMedia, JobPageView } from "@/lib/job-page";
import { jobBlockDefinitions } from "@/lib/recruitment";
import type { Company, Job, JobContentBlock, JobContentItem, JobMedia } from "@/lib/supabase/database.types";

type EditorBlock = JobPageBlock;
type EditorFields = {
  title: string; companyId: string; slug: string; employerLabel: string; category: string;
  city: string; workplaceAddress: string; location: string; workMode: string; employmentType: string;
  employmentFraction: string; workSchedule: string; salaryDisplayMode: "hidden" | "text" | "range";
  salaryText: string; salaryMin: string; salaryMax: string; salaryCurrency: string; salaryPeriod: string;
  startDate: string; applicationDeadline: string; introText: string; shortDescription: string;
  heroImageUrl: string; resumeEnabled: boolean;
};

function itemRows(text: string | null | undefined, itemType: "bullet" | "highlight" | "faq" | "fact" = "bullet") {
  return (text ?? "").split(/\r?\n/).map((body) => body.trim()).filter(Boolean).map((body, index) => ({ itemType, body, title: null, sortOrder: (index + 1) * 10 }));
}

function initialBlocks(job: Job | undefined, blocks: JobContentBlock[], items: JobContentItem[]): EditorBlock[] {
  const itemsByBlock = new Map<string, JobContentItem[]>();
  items.forEach((item) => itemsByBlock.set(item.block_id, [...(itemsByBlock.get(item.block_id) ?? []), item]));
  const saved = new Map(blocks.map((block) => [block.block_type, block]));
  const legacy: Partial<Record<string, string | null>> = job ? {
    intro: job.description, tasks: job.tasks, requirements: job.requirements, advantages: job.advantages,
    benefits: job.benefits, compensation: job.compensation_details, schedule: job.schedule_details,
    location: job.workplace_details, process: job.selection_process, important: job.important_information, closing: job.closing_cta
  } : {};
  return jobBlockDefinitions.map((definition, index) => {
    const block = saved.get(definition.type);
    const savedItems = block ? (itemsByBlock.get(block.id) ?? []) : [];
    const body = block?.body ?? legacy[definition.type] ?? "";
    return {
      id: block?.id,
      type: definition.type,
      eyebrow: block?.eyebrow ?? definition.label,
      title: block?.title ?? definition.defaultTitle,
      body,
      visible: block?.is_visible ?? (["intro", "tasks", "requirements", "benefits", "closing"].includes(definition.type) && Boolean(job)),
      sortOrder: block?.sort_order ?? (index + 1) * 10,
      items: savedItems.length ? savedItems.sort((a, b) => a.sort_order - b.sort_order).map((item) => ({ id: item.id, itemType: item.item_type, title: item.title, body: item.body, sortOrder: item.sort_order })) : definition.list ? itemRows(legacy[definition.type], definition.itemType) : []
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

function initialFields(job: Job | undefined, companies: Company[]): EditorFields {
  return {
    title: job?.title ?? "", companyId: job?.company_id ?? companies[0]?.id ?? "", slug: job?.slug ?? "",
    employerLabel: job?.employer_label ?? "", category: job?.category ?? "", city: job?.city ?? "",
    workplaceAddress: job?.workplace_address ?? "", location: job?.location ?? "", workMode: job?.work_mode ?? "",
    employmentType: job?.employment_type ?? "", employmentFraction: job?.employment_fraction ?? "",
    workSchedule: job?.work_schedule ?? "", salaryDisplayMode: job?.salary_display_mode ?? "text",
    salaryText: job?.salary_text ?? "", salaryMin: job?.salary_min?.toString() ?? "", salaryMax: job?.salary_max?.toString() ?? "",
    salaryCurrency: job?.salary_currency ?? "HUF", salaryPeriod: job?.salary_period ?? "month", startDate: job?.start_date ?? "",
    applicationDeadline: job?.application_deadline ?? "", introText: job?.intro_text ?? "", shortDescription: job?.short_description ?? "",
    heroImageUrl: job?.hero_image_url ?? "", resumeEnabled: job?.resume_enabled ?? true
  };
}

const localReferenceVisibleBlocks = new Set(["intro", "role", "fit", "tasks", "requirements", "advantages", "benefits", "schedule", "process"]);

function localReferenceBlocks(): EditorBlock[] {
  return initialBlocks(undefined, [], []).map((block) => {
    const titles: Partial<Record<EditorBlock["type"], { eyebrow: string; title: string; body?: string }>> = {
      intro: { eyebrow: "Fontos tudnivalók", title: "Az állásról" },
      role: { eyebrow: "Munkakör röviden", title: "Mit csinál ebben a munkakörben?" },
      fit: { eyebrow: "Illeszkedés", title: "Neked való lehet, ha" },
      tasks: { eyebrow: "Feladatok", title: "Mit fogsz csinálni?" },
      requirements: { eyebrow: "Elvárások", title: "Amit kérünk" },
      advantages: { eyebrow: "Előnyt jelent", title: "Előnyt jelent" },
      benefits: { eyebrow: "Amit adunk", title: "Amit adunk" },
      compensation: { eyebrow: "Bér és juttatások", title: "" },
      schedule: { eyebrow: "Gyors döntési adatok", title: "Munkaidő és beosztás" },
      process: { eyebrow: "Jelentkezési folyamat", title: "Hogyan történik a jelentkezés?", body: "A jelentkezés három rövid lépésből áll." }
    };
    const preset = titles[block.type];
    return {
      ...block,
      eyebrow: preset?.eyebrow ?? block.eyebrow,
      title: preset?.title ?? block.title,
      body: preset?.body ?? "",
      visible: localReferenceVisibleBlocks.has(block.type),
      items: block.type === "schedule" ? [
        { itemType: "fact", title: "Kezdés", body: "", sortOrder: 10 },
        { itemType: "fact", title: "Bejárás", body: "", sortOrder: 20 },
        { itemType: "fact", title: "Szerződés", body: "", sortOrder: 30 }
      ] : []
    };
  });
}

function MediaManager({ job, media, onChange }: { job?: Job; media: JobMedia[]; onChange: (media: JobMedia[]) => void }) {
  const [kind, setKind] = useState<"hero" | "gallery" | "social">("hero");
  const [alt, setAlt] = useState("");
  const [focusX, setFocusX] = useState(50);
  const [focusY, setFocusY] = useState(50);
  const [state, setState] = useState<{ pending: boolean; message?: string; error?: boolean }>({ pending: false });

  async function upload(file: File | undefined) {
    if (!file || !job) return;
    setState({ pending: true, message: "Kép feltöltése…" });
    const data = new FormData();
    data.set("job_id", job.id); data.set("kind", kind); data.set("file", file); data.set("alt_text", alt);
    data.set("focus_x", String(focusX)); data.set("focus_y", String(focusY));
    const response = await fetch("/api/admin/job-media", { method: "POST", body: data });
    const result = await response.json() as { media?: JobMedia; error?: string };
    if (!response.ok || !result.media) { setState({ pending: false, message: result.error ?? "A kép nem tölthető fel.", error: true }); return; }
    onChange(kind === "gallery" ? [...media, result.media] : [...media.filter((item) => item.kind !== kind), result.media]);
    setAlt(""); setState({ pending: false, message: "A kép feltöltve." });
  }

  async function update(item: JobMedia) {
    setState({ pending: true, message: "Képadatok mentése…" });
    const response = await fetch("/api/admin/job-media", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, altText: item.alt_text, focusX: item.focus_x, focusY: item.focus_y, sortOrder: item.sort_order }) });
    const result = await response.json() as { media?: JobMedia; error?: string };
    if (!response.ok || !result.media) { setState({ pending: false, message: result.error ?? "A képadatok nem menthetők.", error: true }); return; }
    onChange(media.map((value) => value.id === item.id ? result.media! : value)); setState({ pending: false, message: "Képadatok mentve." });
  }

  async function remove(item: JobMedia) {
    if (!window.confirm("Biztosan törlöd ezt a képet?")) return;
    setState({ pending: true, message: "Kép törlése…" });
    const response = await fetch("/api/admin/job-media", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setState({ pending: false, message: result.error ?? "A kép nem törölhető.", error: true }); return; }
    onChange(media.filter((value) => value.id !== item.id)); setState({ pending: false, message: "A kép törölve." });
  }

  return <section className="admin-card admin-form-section">
    <div className="admin-form-section-header"><h3>Képek</h3><p>JPEG, PNG, WebP vagy AVIF, legfeljebb 8 MB. A fókuszpont a mobil vágást is vezérli.</p></div>
    {!job ? <div className="admin-feedback neutral">A képfeltöltés az első piszkozatmentés után válik elérhetővé.</div> : <div className="admin-form-grid">
      <label className="admin-field">Kép szerepe<select className="admin-select" onChange={(event) => setKind(event.target.value as typeof kind)} value={kind}><option value="hero">Főkép</option><option value="gallery">További kép</option><option value="social">Közösségi előnézeti kép</option></select></label>
      <label className="admin-field">Képfájl<input accept="image/jpeg,image/png,image/webp,image/avif" className="admin-input" disabled={state.pending} onChange={(event) => void upload(event.target.files?.[0])} type="file" /></label>
      <label className="admin-field full">Alternatív szöveg<input className="admin-input" maxLength={300} onChange={(event) => setAlt(event.target.value)} placeholder="Írd le röviden, mi látható a képen" value={alt} /></label>
      <label className="admin-field">Vízszintes fókusz: {focusX}%<input max="100" min="0" onChange={(event) => setFocusX(Number(event.target.value))} type="range" value={focusX} /></label>
      <label className="admin-field">Függőleges fókusz: {focusY}%<input max="100" min="0" onChange={(event) => setFocusY(Number(event.target.value))} type="range" value={focusY} /></label>
    </div>}
    {state.message ? <p className={state.error ? "admin-inline-error" : "admin-inline-success"} role="status">{state.message}</p> : null}
    <div className="admin-media-grid">{media.sort((a, b) => a.sort_order - b.sort_order).map((item) => <article className="admin-media-card" key={item.id}>
      <Image alt={item.alt_text} height={180} src={item.url} unoptimized width={320} />
      <strong>{item.kind === "hero" ? "Főkép" : item.kind === "social" ? "Megosztási kép" : "További kép"}</strong>
      <label className="admin-field">Alternatív szöveg<input className="admin-input" onChange={(event) => onChange(media.map((value) => value.id === item.id ? { ...value, alt_text: event.target.value } : value))} value={item.alt_text} /></label>
      <label className="admin-field">Vízszintes fókusz: {item.focus_x}%<input max="100" min="0" onChange={(event) => onChange(media.map((value) => value.id === item.id ? { ...value, focus_x: Number(event.target.value) } : value))} type="range" value={item.focus_x} /></label>
      <label className="admin-field">Függőleges fókusz: {item.focus_y}%<input max="100" min="0" onChange={(event) => onChange(media.map((value) => value.id === item.id ? { ...value, focus_y: Number(event.target.value) } : value))} type="range" value={item.focus_y} /></label>
      <div className="admin-actions"><button className="admin-button small" onClick={() => void update(item)} type="button">Képadatok mentése</button><button className="admin-button danger small" onClick={() => void remove(item)} type="button">Törlés</button></div>
    </article>)}</div>
  </section>;
}

export default function JobForm({ companies, job, contentBlocks = [], contentItems = [], initialMedia = [] }: { companies: Company[]; job?: Job; contentBlocks?: JobContentBlock[]; contentItems?: JobContentItem[]; initialMedia?: JobMedia[] }) {
  const [fields, setFields] = useState(() => initialFields(job, companies));
  const [blocks, setBlocks] = useState(() => initialBlocks(job, contentBlocks, contentItems));
  const [media, setMedia] = useState(initialMedia);
  const [editVersion, setEditVersion] = useState(0);
  const [submittedVersion, setSubmittedVersion] = useState(-1);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [presetMessage, setPresetMessage] = useState("");
  const [result, formAction, pending] = useActionState(saveJobEditorAction, { ok: false });
  const dirty = editVersion > 0 && !(result.ok && submittedVersion === editVersion);
  const markDirty = () => setEditVersion((version) => version + 1);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => {
    if (!result.ok) return;
    if (!job && result.jobId) window.location.assign(`/admin/allasok/${result.jobId}?saved=1`);
  }, [job, result]);

  function field<K extends keyof EditorFields>(key: K, value: EditorFields[K]) { setFields((current) => ({ ...current, [key]: value })); markDirty(); }
  function updateBlock(type: EditorBlock["type"], update: Partial<EditorBlock>) { setBlocks((current) => current.map((block) => block.type === type ? { ...block, ...update } : block)); markDirty(); }
  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction; if (target < 0 || target >= blocks.length) return;
    const next = [...blocks]; [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next.map((block, blockIndex) => ({ ...block, sortOrder: (blockIndex + 1) * 10 }))); markDirty();
  }
  function updateItem(type: EditorBlock["type"], index: number, update: Partial<JobPageBlock["items"][number]>) {
    const block = blocks.find((item) => item.type === type); if (!block) return;
    updateBlock(type, { items: block.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item) });
  }
  function addItem(type: EditorBlock["type"]) {
    const definition = jobBlockDefinitions.find((item) => item.type === type); const block = blocks.find((item) => item.type === type); if (!block || !definition) return;
    updateBlock(type, { items: [...block.items, { itemType: definition.itemType, title: null, body: "", sortOrder: (block.items.length + 1) * 10 }] });
  }
  function moveItem(type: EditorBlock["type"], index: number, direction: -1 | 1) {
    const block = blocks.find((item) => item.type === type); if (!block) return; const target = index + direction; if (target < 0 || target >= block.items.length) return;
    const next = [...block.items]; [next[index], next[target]] = [next[target], next[index]];
    updateBlock(type, { items: next.map((item, itemIndex) => ({ ...item, sortOrder: (itemIndex + 1) * 10 })) });
  }

  const normalizedFactLabel = (value: string | null | undefined) => (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("hu");
  const factValue = (type: EditorBlock["type"], label: string) => blocks.find((block) => block.type === type)?.items.find((item) => normalizedFactLabel(item.title).includes(normalizedFactLabel(label)))?.body ?? "";
  const mainRequirement = blocks.find((block) => block.type === "requirements")?.items[0]?.body ?? "";
  const compensationDetail = blocks.find((block) => block.type === "compensation")?.body ?? "";

  function updateFact(type: EditorBlock["type"], label: string, body: string) {
    const block = blocks.find((item) => item.type === type); if (!block) return;
    const index = block.items.findIndex((item) => normalizedFactLabel(item.title).includes(normalizedFactLabel(label)));
    const items = index >= 0
      ? block.items.map((item, itemIndex) => itemIndex === index ? { ...item, body } : item)
      : [...block.items, { itemType: "fact" as const, title: label, body, sortOrder: (block.items.length + 1) * 10 }];
    updateBlock(type, { visible: true, items });
  }

  function updateMainRequirement(body: string) {
    const block = blocks.find((item) => item.type === "requirements"); if (!block) return;
    const items = block.items.length
      ? block.items.map((item, index) => index === 0 ? { ...item, body } : item)
      : [{ itemType: "bullet" as const, title: null, body, sortOrder: 10 }];
    updateBlock("requirements", { visible: true, items });
  }

  function applyLocalReferencePreset() {
    if (dirty && !window.confirm("A sablon lecseréli a jelenlegi tartalmi blokkokat. Folytatod?")) return;
    setFields((current) => ({
      ...current,
      workMode: current.workMode || "Helyszíni",
      employmentType: current.employmentType || "Határozatlan idejű",
      employmentFraction: current.employmentFraction || "Teljes munkaidő",
      salaryDisplayMode: "text",
      resumeEnabled: true
    }));
    setBlocks(localReferenceBlocks());
    setPresetMessage("A helyi állásoldal szerkezete betöltve. Töltsd ki a megjelölt gyorsadatokat és tartalmi blokkokat.");
    markDirty();
  }

  const company = companies.find((item) => item.id === fields.companyId) ?? companies[0];
  const preview = useMemo<JobPageView>(() => {
    const heroSource = media.find((item) => item.kind === "hero");
    const mappedMedia = (item: JobMedia): JobPageMedia => ({ id: item.id, kind: item.kind, url: item.url, alt: item.alt_text, focusX: item.focus_x, focusY: item.focus_y, sortOrder: item.sort_order });
    const salary = fields.salaryDisplayMode === "hidden" ? null : fields.salaryDisplayMode === "range" ? `${fields.salaryMin || "?"}–${fields.salaryMax || "?"} ${fields.salaryCurrency}/${fields.salaryPeriod === "hour" ? "óra" : "hó"}` : fields.salaryText;
    const scheduleItems = blocks.find((block) => block.type === "schedule")?.items ?? [];
    const scheduleFact = (needle: string) => scheduleItems.find((item) => item.title?.toLocaleLowerCase("hu").includes(needle))?.body || "";
    const requirements = blocks.find((block) => block.type === "requirements")?.items.filter((item) => item.body.trim()) ?? [];
    const introHighlights = blocks.find((block) => block.type === "intro")?.items.filter((item) => item.itemType === "highlight" && item.body.trim()) ?? [];
    const compensation = blocks.find((block) => block.type === "compensation");
    const clean = (value: string | null | undefined) => (value ?? "").trim().replace(/[.!?]+$/, "");
    const commute = scheduleFact("bejár");
    const quickFacts = [
      { label: "Bér", value: clean(compensation?.title || salary), detail: clean(compensation?.body?.split(",")[0]) },
      { label: "Helyszín", value: clean(fields.city || fields.location), detail: clean(fields.workplaceAddress) },
      { label: "Munkarend", value: clean([fields.employmentFraction, fields.workSchedule].filter(Boolean).join(", ") || fields.employmentType), detail: clean(scheduleFact("szerződés") || fields.employmentType) },
      { label: "Kezdés", value: clean(scheduleFact("kezd")), detail: clean(scheduleFact("kezd")).toLocaleLowerCase("hu").includes("megegyezés") ? "Gyors egyeztetéssel" : null },
      { label: "Bejárás", value: clean(commute), detail: commute.toLocaleLowerCase("hu").includes("autó") ? "Napi irodai jelenlét" : null },
      { label: "Fő feltétel", value: clean(requirements[0]?.body) }
    ].filter((fact) => fact.value);
    return {
      id: job?.id ?? "preview", slug: fields.slug, title: fields.title || "Új pozíció", employer: fields.employerLabel || company?.name || "Megbízónk",
      companyName: company?.name || "Megbízónk", category: fields.category || null, intro: fields.introText || null,
      summary: fields.shortDescription || null, salary,
      facts: [[fields.city, fields.workplaceAddress].filter(Boolean).join(" · ") || fields.location, fields.workMode, fields.employmentFraction || fields.employmentType, fields.workSchedule, salary].filter(Boolean) as string[],
      heroFacts: [
        { label: "Hely", value: fields.city || fields.location },
        { label: "Munkarend", value: [fields.employmentFraction, fields.workSchedule].filter(Boolean).join(", ") || fields.employmentType },
        { label: "Kezdés", value: scheduleFact("kezd") },
        { label: "Bejárás", value: scheduleFact("bejár") },
        { label: "Fő feltétel", value: requirements[0]?.body || "" }
      ].filter((fact) => fact.value),
      quickFacts,
      heroHighlights: (introHighlights.length ? introHighlights : requirements).slice(0, 3).map((item) => item.body),
      hero: heroSource ? mappedMedia(heroSource) : fields.heroImageUrl ? { kind: "hero", url: fields.heroImageUrl, alt: job?.hero_image_alt ?? fields.title, focusX: job?.hero_focus_x ?? 50, focusY: job?.hero_focus_y ?? 50, sortOrder: 0 } : null,
      gallery: media.filter((item) => item.kind === "gallery").map(mappedMedia), socialImage: media.find((item) => item.kind === "social")?.url ?? null,
      blocks: blocks.map((block) => block.type === "company" && !block.body ? { ...block, body: company?.description ?? "" } : block), applicationDeadline: fields.applicationDeadline || null
    };
  }, [blocks, company, fields, job, media]);

  return <div className="job-editor-shell">
    <form action={formAction} className="job-editor-form" onChange={markDirty} onSubmit={() => setSubmittedVersion(editVersion)}>
      {job ? <input name="job_id" type="hidden" value={job.id} /> : null}
      <input name="content_blocks_json" type="hidden" value={JSON.stringify(blocks)} />
      {!job ? <section className="admin-card admin-form-section admin-template-preset">
        <div className="admin-form-section-header"><h3>Oldalsablon</h3><p>Ezzel a publikus oldalt a helyi mintával azonos szerkezetben indíthatod el.</p></div>
        <div className="admin-template-preset-content">
          <div><strong>Helyi állásoldal felépítése</strong><ul><li>képes fejléc és öt kiemelt adat</li><li>munkakör, gyors döntési adatok és illeszkedés</li><li>feladatok, elvárások, előnyök és amit adunk</li><li>háromlépéses jelentkezési folyamat és jelentkezési űrlap</li></ul></div>
          <button className="admin-button" onClick={applyLocalReferencePreset} type="button">Helyi állásoldal-sablon betöltése</button>
        </div>
        {presetMessage ? <p className="admin-inline-success" role="status">{presetMessage}</p> : null}
      </section> : null}

      <section className="admin-card admin-form-section">
        <div className="admin-form-section-header"><h3>Alapadatok</h3><p>Ezek az adatok a listában, a fejlécben, a SEO-ban és a jelentkezési folyamatban is megjelennek.</p></div>
        <div className="admin-form-grid">
          <label className="admin-field">Pozíció neve *<input className="admin-input" maxLength={160} name="title" onChange={(event) => field("title", event.target.value)} required value={fields.title} /></label>
          <label className="admin-field">Cég *<select className="admin-select" name="company_id" onChange={(event) => field("companyId", event.target.value)} required value={fields.companyId}><option value="">Válassz céget</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="admin-field">Megjelenő munkáltatónév<input className="admin-input" name="employer_label" onChange={(event) => field("employerLabel", event.target.value)} placeholder="Üresen a cégnév, vagy pl. Megbízónk" value={fields.employerLabel} /></label>
          <label className="admin-field">Slug *<input className="admin-input" name="slug" onChange={(event) => field("slug", event.target.value.toLowerCase())} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required value={fields.slug} /><small>/allas/{fields.slug || "egyedi-slug"}</small></label>
          <label className="admin-field">Kategória<input className="admin-input" name="category" onChange={(event) => field("category", event.target.value)} value={fields.category} /></label>
          <label className="admin-field">Település<input className="admin-input" name="city" onChange={(event) => field("city", event.target.value)} value={fields.city} /></label>
          <label className="admin-field full">Pontos munkavégzési hely<input className="admin-input" name="workplace_address" onChange={(event) => field("workplaceAddress", event.target.value)} value={fields.workplaceAddress} /></label>
          <label className="admin-field">Munkavégzés típusa<input className="admin-input" list="work-modes" name="work_mode" onChange={(event) => field("workMode", event.target.value)} value={fields.workMode} /><datalist id="work-modes"><option value="Helyszíni" /><option value="Hibrid" /><option value="Távoli" /></datalist></label>
          <label className="admin-field">Foglalkoztatás formája<input className="admin-input" list="employment-types" name="employment_type" onChange={(event) => field("employmentType", event.target.value)} value={fields.employmentType} /><datalist id="employment-types"><option value="Határozatlan idejű" /><option value="Határozott idejű" /><option value="Alkalmi munka" /></datalist></label>
          <label className="admin-field">Teljes vagy részmunkaidő<input className="admin-input" list="fractions" name="employment_fraction" onChange={(event) => field("employmentFraction", event.target.value)} value={fields.employmentFraction} /><datalist id="fractions"><option value="Teljes munkaidő" /><option value="Részmunkaidő" /></datalist></label>
          <label className="admin-field">Műszakrend<input className="admin-input" name="work_schedule" onChange={(event) => field("workSchedule", event.target.value)} value={fields.workSchedule} /></label>
          <label className="admin-field">Kezdési időpont<input className="admin-input" name="start_date" onChange={(event) => field("startDate", event.target.value)} type="date" value={fields.startDate} /></label>
          <label className="admin-field">Jelentkezési határidő<input className="admin-input" name="application_deadline" onChange={(event) => field("applicationDeadline", event.target.value)} type="date" value={fields.applicationDeadline} /></label>
        </div>
      </section>

      <section className="admin-card admin-form-section">
        <div className="admin-form-section-header"><h3>Fejléc és fizetés</h3><p>A szöveg biztonságosan, HTML futtatása nélkül jelenik meg.</p></div>
        <div className="admin-form-grid">
          <label className="admin-field full">Figyelemfelkeltő bevezető<input className="admin-input" maxLength={180} name="intro_text" onChange={(event) => field("introText", event.target.value)} value={fields.introText} /></label>
          <label className="admin-field full">Rövid összefoglaló<textarea className="admin-textarea" maxLength={800} name="short_description" onChange={(event) => field("shortDescription", event.target.value)} rows={4} value={fields.shortDescription} /></label>
          <label className="admin-field">Fizetés megjelenítése<select className="admin-select" name="salary_display_mode" onChange={(event) => field("salaryDisplayMode", event.target.value as EditorFields["salaryDisplayMode"])} value={fields.salaryDisplayMode}><option value="hidden">Ne jelenjen meg</option><option value="text">Szöveges</option><option value="range">Összegsáv</option></select></label>
          {fields.salaryDisplayMode === "text" ? <label className="admin-field">Fizetés szövege<input className="admin-input" name="salary_text" onChange={(event) => field("salaryText", event.target.value)} value={fields.salaryText} /></label> : null}
          {fields.salaryDisplayMode === "range" ? <><label className="admin-field">Minimum<input className="admin-input" min="0" name="salary_min" onChange={(event) => field("salaryMin", event.target.value)} type="number" value={fields.salaryMin} /></label><label className="admin-field">Maximum<input className="admin-input" min="0" name="salary_max" onChange={(event) => field("salaryMax", event.target.value)} type="number" value={fields.salaryMax} /></label><label className="admin-field">Pénznem<input className="admin-input" maxLength={3} name="salary_currency" onChange={(event) => field("salaryCurrency", event.target.value.toUpperCase())} value={fields.salaryCurrency} /></label><label className="admin-field">Időszak<select className="admin-select" name="salary_period" onChange={(event) => field("salaryPeriod", event.target.value)} value={fields.salaryPeriod}><option value="month">Havi</option><option value="hour">Órabér</option><option value="day">Napidíj</option></select></label></> : null}
          <label className="admin-field full">Külső főkép URL (átmeneti/kompatibilitási mező)<input className="admin-input" name="hero_image_url" onChange={(event) => field("heroImageUrl", event.target.value)} type="url" value={fields.heroImageUrl} /></label>
          <label className="admin-checkbox full"><input checked={fields.resumeEnabled} name="resume_enabled" onChange={(event) => field("resumeEnabled", event.target.checked)} type="checkbox" /> Opcionális külön önéletrajz-feltöltés engedélyezése</label>
        </div>
      </section>

      <section className="admin-card admin-form-section" id="gyorsadatok">
        <div className="admin-form-section-header"><h3>Gyors döntési adatok</h3><p>Ez a hat adat a helyi mintához hasonló kártyákban jelenik meg. Az itt végzett módosítások a kapcsolódó alapadatokat és tartalmi blokkokat is frissítik.</p></div>
        <div className="admin-quick-facts-grid">
          <label className="admin-field" data-quick-fact="salary">Bér<input className="admin-input" onChange={(event) => { if (fields.salaryDisplayMode !== "text") field("salaryDisplayMode", "text"); field("salaryText", event.target.value); }} placeholder="pl. Átlag ~650 000 Ft/hó fix + bónusz" value={fields.salaryText} /><small>Beíráskor szöveges bérmegjelenítésre vált.</small></label>
          <label className="admin-field" data-quick-fact="salary-detail">Bér részlete<input className="admin-input" onChange={(event) => updateBlock("compensation", { visible: true, body: event.target.value })} placeholder="pl. Stabil fix rész + mérhető bónusz" value={compensationDetail} /></label>
          <label className="admin-field" data-quick-fact="location">Helyszín<input className="admin-input" onChange={(event) => field("city", event.target.value)} placeholder="pl. Nagytarcsa" value={fields.city} /></label>
          <label className="admin-field" data-quick-fact="address">Pontos cím / kiegészítés<input className="admin-input" onChange={(event) => field("workplaceAddress", event.target.value)} value={fields.workplaceAddress} /></label>
          <label className="admin-field" data-quick-fact="schedule">Munkarend<input className="admin-input" onChange={(event) => field("employmentFraction", event.target.value)} placeholder="pl. Teljes munkaidő" value={fields.employmentFraction} /></label>
          <label className="admin-field" data-quick-fact="work-schedule">Beosztás<input className="admin-input" onChange={(event) => field("workSchedule", event.target.value)} placeholder="pl. hétfő–péntek" value={fields.workSchedule} /></label>
          <label className="admin-field" data-quick-fact="contract">Szerződés / foglalkoztatás<input className="admin-input" onChange={(event) => field("employmentType", event.target.value)} placeholder="pl. Határozatlan idejű" value={fields.employmentType} /></label>
          <label className="admin-field" data-quick-fact="start">Kezdés<input className="admin-input" onChange={(event) => updateFact("schedule", "Kezdés", event.target.value)} placeholder="pl. Megegyezés szerint" value={factValue("schedule", "kezd")} /></label>
          <label className="admin-field" data-quick-fact="commute">Bejárás<input className="admin-input" onChange={(event) => updateFact("schedule", "Bejárás", event.target.value)} placeholder="pl. Saját autó szükséges" value={factValue("schedule", "bejár")} /></label>
          <label className="admin-field" data-quick-fact="main-requirement">Fő feltétel<input className="admin-input" onChange={(event) => updateMainRequirement(event.target.value)} placeholder="A legfontosabb elvárás" value={mainRequirement} /><small>Az „Amit kérünk” blokk első eleme is ez lesz.</small></label>
        </div>
      </section>

      <MediaManager job={job} media={media} onChange={(value) => { setMedia(value); markDirty(); }} />

      <section className="admin-card admin-form-section">
        <div className="admin-form-section-header"><h3>Tartalmi blokkok</h3><p>A blokktípusok központilag rögzítettek. Megjelenítheted, elrejtheted és átrendezheted őket; egyedi CSS vagy elrendezés nem adható meg.</p></div>
        {blocks.map((block, blockIndex) => {
          const definition = jobBlockDefinitions.find((item) => item.type === block.type)!;
          return <details className="admin-question" key={block.type} open={["intro", "tasks"].includes(block.type)}>
            <summary><span>{blockIndex + 1}. {definition.label}</span><span className={block.visible ? "admin-block-visible" : "admin-block-hidden"}>{block.visible ? "Látható" : "Rejtett"}</span></summary>
            <div className="admin-form-grid">
              <label className="admin-checkbox full"><input checked={block.visible} onChange={(event) => updateBlock(block.type, { visible: event.target.checked })} type="checkbox" /> Blokk megjelenítése</label>
              <label className="admin-field">Kis címsor<input className="admin-input" onChange={(event) => updateBlock(block.type, { eyebrow: event.target.value })} value={block.eyebrow ?? ""} /></label>
              <label className="admin-field">Blokk címe<input className="admin-input" onChange={(event) => updateBlock(block.type, { title: event.target.value })} value={block.title ?? ""} /></label>
              {!definition.list || block.type === "role" ? <label className="admin-field full">Szöveg<textarea className="admin-textarea" onChange={(event) => updateBlock(block.type, { body: event.target.value })} rows={4} value={block.body ?? ""} /></label> : null}
            </div>
            {definition.list ? <div className="admin-list-editor">{block.items.map((item, itemIndex) => <div className="admin-list-editor-row" key={item.id ?? `${block.type}-${itemIndex}`}>
              {(definition.itemType === "faq" || definition.itemType === "fact" || block.type === "fit") ? <input aria-label={definition.itemType === "faq" ? "Kérdés" : block.type === "fit" ? "Csoport" : "Megnevezés"} className="admin-input" onChange={(event) => updateItem(block.type, itemIndex, { title: event.target.value })} placeholder={definition.itemType === "faq" ? "Kérdés" : block.type === "fit" ? "Csoport, pl. Nem biztos, hogy neked való, ha" : "Megnevezés"} value={item.title ?? ""} /> : null}
              <textarea aria-label="Listaelem szövege" className="admin-textarea" onChange={(event) => updateItem(block.type, itemIndex, { body: event.target.value })} rows={2} value={item.body} />
              <div className="admin-list-controls"><button aria-label="Mozgatás felfelé" className="admin-button secondary small" disabled={itemIndex === 0} onClick={() => moveItem(block.type, itemIndex, -1)} type="button">↑</button><button aria-label="Mozgatás lefelé" className="admin-button secondary small" disabled={itemIndex === block.items.length - 1} onClick={() => moveItem(block.type, itemIndex, 1)} type="button">↓</button><button className="admin-button danger small" onClick={() => updateBlock(block.type, { items: block.items.filter((_, index) => index !== itemIndex) })} type="button">Törlés</button></div>
            </div>)}<button className="admin-button secondary" onClick={() => addItem(block.type)} type="button">+ Új {definition.itemType === "faq" ? "kérdés" : definition.itemType === "fact" ? "adat" : definition.itemType === "highlight" ? "kiemelés" : "sor"} hozzáadása</button></div> : null}
            <div className="admin-form-footer"><button className="admin-button secondary small" disabled={blockIndex === 0} onClick={() => moveBlock(blockIndex, -1)} type="button">Blokk feljebb</button><button className="admin-button secondary small" disabled={blockIndex === blocks.length - 1} onClick={() => moveBlock(blockIndex, 1)} type="button">Blokk lejjebb</button></div>
          </details>;
        })}
      </section>

      {result.error ? <div className="admin-feedback error" role="alert">{result.error}</div> : null}
      {result.ok && !dirty ? <div className="admin-feedback" role="status">A módosítások mentve.</div> : null}
      <div className="admin-editor-savebar"><span>{pending ? "Mentés folyamatban…" : dirty ? "Nem mentett módosítások" : "Minden módosítás mentve"}</span><button className="admin-button" disabled={pending} type="submit">{job ? "Módosítások mentése" : "Mentés piszkozatként"}</button></div>
    </form>

    <aside className="job-live-preview-panel">
      <div className="job-live-preview-toolbar"><div><strong>Élő előnézet</strong><small>Ugyanaz a központi sablon, mint a publikus oldalon</small></div><div className="admin-actions"><button aria-pressed={previewMode === "desktop"} className={`admin-button small ${previewMode === "desktop" ? "" : "secondary"}`} onClick={() => setPreviewMode("desktop")} type="button">Asztali</button><button aria-pressed={previewMode === "mobile"} className={`admin-button small ${previewMode === "mobile" ? "" : "secondary"}`} onClick={() => setPreviewMode("mobile")} type="button">Mobil</button></div></div>
      <div className={`job-live-preview-frame ${previewMode}`}><JobPageTemplate preview view={preview} /></div>
    </aside>
  </div>;
}
