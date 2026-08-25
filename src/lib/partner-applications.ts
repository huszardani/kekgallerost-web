import type { ApplicationStatus } from "@/lib/supabase/database.types";

export type PartnerApplicationStatus = Extract<
  ApplicationStatus,
  "new" | "reviewed" | "contacted" | "interview" | "rejected" | "hired"
>;

export const partnerApplicationStatuses: Array<{ value: PartnerApplicationStatus; label: string }> = [
  { value: "new", label: "Új" },
  { value: "reviewed", label: "Felhívandó" },
  { value: "contacted", label: "Felhívva" },
  { value: "interview", label: "Interjú" },
  { value: "rejected", label: "Elutasítva" },
  { value: "hired", label: "Felvéve" }
];

const partnerStatusValues = new Set(partnerApplicationStatuses.map((status) => status.value));

const partnerReadOnlyStatusLabels: Partial<Record<ApplicationStatus, string>> = {
  withdrawn: "Visszalépett",
  not_qualified: "Feltételnek nem felel meg"
};

export function isPartnerApplicationStatus(value: string): value is PartnerApplicationStatus {
  return partnerStatusValues.has(value as PartnerApplicationStatus);
}
export function partnerApplicationStatusLabel(status: ApplicationStatus) {
  return partnerApplicationStatuses.find((item) => item.value === status)?.label ?? partnerReadOnlyStatusLabels[status] ?? status;
}


export function partnerApplicationStatusFromForm(value: unknown): PartnerApplicationStatus | null {

  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !isPartnerApplicationStatus(value)) {
    throw new Error("Érvénytelen partneri jelentkezési státusz.");
  }
  return value;
}
