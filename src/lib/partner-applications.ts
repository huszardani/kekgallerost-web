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

export function isPartnerApplicationStatus(value: string): value is PartnerApplicationStatus {
  return partnerStatusValues.has(value as PartnerApplicationStatus);
}

export function partnerApplicationStatusFromForm(value: unknown): PartnerApplicationStatus | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !isPartnerApplicationStatus(value)) {
    throw new Error("Érvénytelen partneri jelentkezési státusz.");
  }
  return value;
}
