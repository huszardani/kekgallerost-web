"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { applicationStatuses } from "@/lib/applications";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ApplicationStatus } from "@/lib/supabase/database.types";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function budapestLocalToIso(value: FormDataEntryValue | null) {
  const text = optionalText(value);
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text);
  if (!match) throw new Error("Érvénytelen dátum/idő.");

  const [, year, month, day, hour, minute] = match;
  const targetAsUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Budapest",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  const offsetAt = (date: Date) => {
    const values = Object.fromEntries(
      formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
    );
    const represented = Date.UTC(+values.year, +values.month - 1, +values.day, +values.hour, +values.minute, +values.second);
    return represented - date.getTime();
  };
  let result = new Date(targetAsUtc - offsetAt(new Date(targetAsUtc)));
  result = new Date(targetAsUtc - offsetAt(result));
  return result.toISOString();
}

export async function updateApplicationAction(formData: FormData) {
  await requireRole("partner");
  const statusValue = String(formData.get("status") ?? "");
  if (!applicationStatuses.some((status) => status.value === statusValue)) {
    throw new Error("Érvénytelen jelentkezési státusz.");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("partner_update_application", {
    p_application_id: String(formData.get("application_id") ?? ""),
    p_status: statusValue as ApplicationStatus,
    p_partner_note: optionalText(formData.get("partner_note")),
    p_callback_at: budapestLocalToIso(formData.get("callback_at")),
    p_last_contacted_at: budapestLocalToIso(formData.get("last_contacted_at"))
  });
  if (error) throw new Error(error.message);
  revalidatePath("/partner");
}

