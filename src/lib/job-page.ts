import { formatSalary } from "@/lib/recruitment";
import type {
  Company,
  Job,
  JobBlockType,
  JobContentBlock,
  JobContentItem,
  JobMedia
} from "@/lib/supabase/database.types";

export type JobPageItem = {
  id?: string;
  itemType: "bullet" | "highlight" | "fact" | "faq";
  title?: string | null;
  body: string;
  sortOrder: number;
};

export type JobPageBlock = {
  id?: string;
  type: JobBlockType;
  eyebrow?: string | null;
  title?: string | null;
  body?: string | null;
  visible: boolean;
  sortOrder: number;
  items: JobPageItem[];
};

export type JobPageMedia = {
  id?: string;
  kind: "hero" | "gallery" | "social";
  url: string;
  alt: string;
  focusX: number;
  focusY: number;
  sortOrder: number;
};

export type JobPageFact = { label: string; value: string };

export type JobPageView = {
  id: string;
  slug: string;
  title: string;
  employer: string;
  companyName: string;
  category: string | null;
  intro: string | null;
  summary: string | null;
  salary: string | null;
  facts: string[];
  heroFacts: JobPageFact[];
  heroHighlights: string[];
  hero: JobPageMedia | null;
  gallery: JobPageMedia[];
  socialImage: string | null;
  blocks: JobPageBlock[];
  applicationDeadline: string | null;
};

const legacyBlocks: Array<{
  type: JobBlockType;
  title: string;
  field: keyof Pick<Job, "description" | "tasks" | "requirements" | "advantages" | "benefits" | "compensation_details" | "schedule_details" | "workplace_details" | "selection_process" | "important_information" | "closing_cta">;
}> = [
  { type: "intro", title: "Az állásról", field: "description" },
  { type: "tasks", title: "Főbb feladatok", field: "tasks" },
  { type: "requirements", title: "Elvárások", field: "requirements" },
  { type: "advantages", title: "Előnyt jelent", field: "advantages" },
  { type: "benefits", title: "Amit kínálunk", field: "benefits" },
  { type: "compensation", title: "Fizetés és juttatások", field: "compensation_details" },
  { type: "schedule", title: "Munkaidő és beosztás", field: "schedule_details" },
  { type: "location", title: "Munkavégzés helye", field: "workplace_details" },
  { type: "process", title: "Kiválasztási folyamat", field: "selection_process" },
  { type: "important", title: "Fontos tudnivalók", field: "important_information" },
  { type: "closing", title: "Jelentkezz most", field: "closing_cta" }
];

function normalized(value: string | null | undefined) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function firstFact(items: JobPageItem[], label: string) {
  const needle = normalized(label);
  return items.find((item) => normalized(item.title).includes(needle))?.body || null;
}

export function buildJobPageView(input: {
  job: Job;
  company: Company;
  blocks?: JobContentBlock[];
  items?: JobContentItem[];
  media?: JobMedia[];
}): JobPageView {
  const { job, company } = input;
  const itemsByBlock = new Map<string, JobPageItem[]>();
  for (const item of input.items ?? []) {
    const current = itemsByBlock.get(item.block_id) ?? [];
    current.push({ id: item.id, itemType: item.item_type, title: item.title, body: item.body, sortOrder: item.sort_order });
    itemsByBlock.set(item.block_id, current);
  }

  let blocks: JobPageBlock[] = (input.blocks ?? []).map((block) => ({
    id: block.id,
    type: block.block_type,
    eyebrow: block.eyebrow,
    title: block.title,
    body: block.block_type === "company" && !block.body ? company.description : block.body,
    visible: block.is_visible,
    sortOrder: block.sort_order,
    items: (itemsByBlock.get(block.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
  }));

  if (blocks.length === 0) {
    blocks = legacyBlocks.map((definition, index) => ({
      type: definition.type,
      title: definition.title,
      body: job[definition.field],
      visible: Boolean(job[definition.field]),
      sortOrder: (index + 1) * 10,
      items: []
    }));
    if (company.description) blocks.push({ type: "company", title: "A munkáltatóról", body: company.description, visible: true, sortOrder: 120, items: [] });
  }

  const visibleBlocks = blocks
    .filter((block) => block.visible && (block.body || block.items.length || block.type === "company"))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const scheduleItems = visibleBlocks.find((block) => block.type === "schedule")?.items ?? [];
  const requirements = visibleBlocks.find((block) => block.type === "requirements")?.items.filter((item) => item.body.trim()) ?? [];
  const introHighlights = visibleBlocks
    .find((block) => block.type === "intro")
    ?.items.filter((item) => item.itemType === "highlight" && item.body.trim()) ?? [];

  const media: JobPageMedia[] = (input.media ?? []).map((item) => ({
    id: item.id,
    kind: item.kind,
    url: item.url,
    alt: item.alt_text,
    focusX: item.focus_x,
    focusY: item.focus_y,
    sortOrder: item.sort_order
  }));
  const hero = media.filter((item) => item.kind === "hero").sort((a, b) => a.sortOrder - b.sortOrder)[0]
    ?? (job.hero_image_url ? { kind: "hero" as const, url: job.hero_image_url, alt: job.hero_image_alt ?? job.title, focusX: job.hero_focus_x, focusY: job.hero_focus_y, sortOrder: 0 } : null);
  const social = media.filter((item) => item.kind === "social").sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const salary = formatSalary(job);
  const location = [job.city, job.workplace_address].filter(Boolean).join(" · ") || job.location;
  const schedule = [job.employment_fraction, job.work_schedule].filter(Boolean).join(", ") || job.employment_type;
  const heroFacts = [
    { label: "Hely", value: job.city || job.location || "" },
    { label: "Munkarend", value: schedule || "" },
    { label: "Kezdés", value: job.start_date_text || firstFact(scheduleItems, "kezd") || "" },
    { label: "Bejárás", value: firstFact(scheduleItems, "bejár") || "" },
    { label: "Fő feltétel", value: requirements[0]?.body || "" }
  ].filter((fact) => fact.value.trim());

  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    employer: job.employer_label || company.name,
    companyName: company.name,
    category: job.category,
    intro: job.intro_text,
    summary: job.short_description ?? job.summary,
    salary,
    facts: [location, job.work_mode, job.employment_fraction ?? job.employment_type, job.work_schedule, salary].filter((value): value is string => Boolean(value)),
    heroFacts,
    heroHighlights: (introHighlights.length ? introHighlights : requirements).slice(0, 3).map((item) => item.body),
    hero,
    gallery: media.filter((item) => item.kind === "gallery").sort((a, b) => a.sortOrder - b.sortOrder),
    socialImage: social?.url ?? job.social_image_url ?? hero?.url ?? null,
    blocks: visibleBlocks,
    applicationDeadline: job.application_deadline
  };
}
