import type { ApplicationStatus } from "@/lib/supabase/database.types";

export const applicationStatuses: Array<{
  value: ApplicationStatus;
  label: string;
}> = [
  { value: "new", label: "Új" },
  { value: "contacted", label: "Kapcsolatfelvétel megtörtént" },
  { value: "no_answer", label: "Nem válaszolt" },
  { value: "suitable", label: "Alkalmas" },
  { value: "not_suitable", label: "Nem alkalmas" },
  { value: "second_call", label: "Második hívás" },
  { value: "callback_needed", label: "Visszahívás szükséges" },
  { value: "hired", label: "Felvéve" },
  { value: "rejected", label: "Elutasítva" }
];

export function applicationStatusLabel(status: ApplicationStatus) {
  return applicationStatuses.find((item) => item.value === status)?.label ?? status;
}

