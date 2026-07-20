import type {
  ApplicationStatus,
  JobBlockType,
  JobStatus,
  QuestionType
} from "@/lib/supabase/database.types";

export const jobStatuses: Array<{ value: JobStatus; label: string; tone: string }> = [
  { value: "draft", label: "Piszkozat", tone: "neutral" },
  { value: "ready", label: "Publikálásra kész", tone: "info" },
  { value: "published", label: "Aktív", tone: "success" },
  { value: "paused", label: "Szüneteltetett", tone: "warning" },
  { value: "closed", label: "Lezárt", tone: "danger" },
  { value: "archived", label: "Archivált", tone: "neutral" }
];

export const applicationStatuses: Array<{ value: ApplicationStatus; label: string }> = [
  { value: "new", label: "Új" },
  { value: "reviewed", label: "Átnézve" },
  { value: "contacted", label: "Kapcsolatfelvétel" },
  { value: "interview", label: "Interjú" },
  { value: "hired", label: "Felvéve" },
  { value: "rejected", label: "Elutasítva" },
  { value: "withdrawn", label: "Visszalépett" },
  { value: "not_qualified", label: "Feltételnek nem felel meg" }
];

export const questionTypes: Array<{ value: QuestionType; label: string }> = [
  { value: "text", label: "Rövid szöveg" },
  { value: "textarea", label: "Hosszú szöveg" },
  { value: "radio", label: "Egy válasz kiválasztása" },
  { value: "select", label: "Legördülő lista" },
  { value: "multiselect", label: "Több válasz kiválasztása" },
  { value: "boolean", label: "Igen / nem" },
  { value: "number", label: "Szám" },
  { value: "date", label: "Dátum" },
  { value: "checkbox", label: "Jelölőnégyzet" },
  { value: "file", label: "Általános fájlfeltöltés" },
  { value: "resume", label: "Önéletrajz-feltöltés" }
];

export const jobBlockDefinitions: Array<{
  type: JobBlockType;
  label: string;
  defaultTitle: string;
  list: boolean;
  itemType: "bullet" | "highlight" | "faq" | "fact";
}> = [
  { type: "intro", label: "Bevezető", defaultTitle: "Az állásról", list: true, itemType: "highlight" },
  { type: "role", label: "A munkakör", defaultTitle: "A munkakör röviden", list: true, itemType: "bullet" },
  { type: "fit", label: "Kinek való", defaultTitle: "Neked való, ha", list: true, itemType: "bullet" },
  { type: "tasks", label: "Feladatok", defaultTitle: "Főbb feladatok", list: true, itemType: "bullet" },
  { type: "requirements", label: "Elvárások", defaultTitle: "Amit kérünk", list: true, itemType: "bullet" },
  { type: "advantages", label: "Előnyt jelent", defaultTitle: "Előnyt jelent", list: true, itemType: "bullet" },
  { type: "benefits", label: "Amit kínálunk", defaultTitle: "Amit kínálunk", list: true, itemType: "bullet" },
  { type: "compensation", label: "Fizetés és juttatások", defaultTitle: "Fizetés és juttatások", list: true, itemType: "bullet" },
  { type: "schedule", label: "Munkaidő és beosztás", defaultTitle: "Munkaidő és beosztás", list: true, itemType: "fact" },
  { type: "location", label: "Munkavégzés helye", defaultTitle: "Munkavégzés helye", list: true, itemType: "fact" },
  { type: "process", label: "Kiválasztási folyamat", defaultTitle: "Kiválasztási folyamat", list: false, itemType: "bullet" },
  { type: "company", label: "A munkáltatóról", defaultTitle: "A munkáltatóról", list: false, itemType: "bullet" },
  { type: "faq", label: "Gyakori kérdések", defaultTitle: "Gyakori kérdések", list: true, itemType: "faq" },
  { type: "important", label: "Fontos tudnivalók", defaultTitle: "Fontos tudnivalók", list: false, itemType: "bullet" },
  { type: "closing", label: "Záró felhívás", defaultTitle: "Jelentkezz most", list: false, itemType: "bullet" }
];

export const allowedJobTransitions: Record<JobStatus, JobStatus[]> = {
  draft: ["ready", "published", "archived"],
  ready: ["draft", "published", "archived"],
  published: ["paused", "closed", "archived"],
  paused: ["published", "closed", "archived"],
  closed: ["published", "archived"],
  archived: ["draft"]
};

export const allowedResumeMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);
export const allowedGeneralFileMimeTypes = new Set([
  ...allowedResumeMimeTypes,
  "image/jpeg",
  "image/png"
]);
export const allowedJobImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export const maxResumeSize = 10 * 1024 * 1024;
export const maxJobImageSize = 8 * 1024 * 1024;

export function canTransitionJob(from: JobStatus, to: JobStatus) {
  return allowedJobTransitions[from].includes(to);
}

export function jobStatusLabel(status: JobStatus) {
  return jobStatuses.find((item) => item.value === status)?.label ?? status;
}

export function applicationStatusLabel(status: ApplicationStatus) {
  return applicationStatuses.find((item) => item.value === status)?.label ?? status;
}

export function legacyQuestionType(type: QuestionType) {
  if (type === "textarea") return "long_text" as const;
  if (type === "radio") return "single_choice" as const;
  if (type === "select") return "single_choice" as const;
  if (type === "multiselect") return "multi_choice" as const;
  if (type === "boolean" || type === "checkbox") return "yes_no" as const;
  if (type === "number") return "number" as const;
  if (type === "file" || type === "resume") return "file" as const;
  return "short_text" as const;
}

export function sanitizeFilename(filename: string) {
  const extension = filename.includes(".") ? `.${filename.split(".").pop()?.toLowerCase()}` : "";
  const base = filename.replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `${base.replace(/^-+|-+$/g, "").slice(0, 80) || "dokumentum"}${extension}`;
}

export function isAllowedResume(file: Pick<File, "size" | "type">) {
  return file.size > 0 && file.size <= maxResumeSize && allowedResumeMimeTypes.has(file.type);
}

export function isAllowedGeneralFile(file: Pick<File, "size" | "type">) {
  return file.size > 0 && file.size <= maxResumeSize && allowedGeneralFileMimeTypes.has(file.type);
}

export function isAllowedJobImage(file: Pick<File, "size" | "type">) {
  return file.size > 0 && file.size <= maxJobImageSize && allowedJobImageMimeTypes.has(file.type);
}

export function isValidSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function normalizeList(values: unknown) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => String(value).trim()).filter(Boolean);
}

export function answerMatchesRule(answer: string | string[] | boolean | null, ruleValues: string[]) {
  const normalized = Array.isArray(answer) ? answer.map(String) : answer === null ? [] : [String(answer)];
  return normalized.some((value) => ruleValues.includes(value));
}

export function formatSalary(input: {
  salary_display_mode: "hidden" | "text" | "range";
  salary_text: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
}) {
  if (input.salary_display_mode === "hidden") return null;
  if (input.salary_display_mode === "text") return input.salary_text;
  const formatter = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });
  const range = [input.salary_min, input.salary_max].filter((value): value is number => value !== null).map((value) => formatter.format(value)).join("–");
  if (!range) return input.salary_text;
  const period = input.salary_period === "hour" ? "óra" : input.salary_period === "day" ? "nap" : "hó";
  return `${range} ${input.salary_currency}/${period}`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Budapest"
  }).format(new Date(value));
}

export function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function safeAdminReturn(value: FormDataEntryValue | null, fallback = "/admin/attekintes") {
  const path = String(value ?? "");
  return path.startsWith("/admin/") && !path.startsWith("//") ? path : fallback;
}
