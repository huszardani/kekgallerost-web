import { NextResponse } from "next/server";
import { validateCompanyLead } from "@/lib/company-leads";
import { persistCompanyLeadAndNotify } from "@/lib/company-lead-notification-flow";
import { sendCompanyLeadNotification } from "@/lib/email/company-lead-notification";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const FAILURE_MESSAGE = "A beküldés most nem sikerült. Az adataid megmaradtak, kérjük, próbáld újra.";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 50_000) {
    return NextResponse.json({ ok: false, error: "A beküldött adatok túl nagyok." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Érvénytelen űrlapadatok." }, { status: 400 });
  }

  const validation = validateCompanyLead(body);
  if ("error" in validation) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }
  const lead = validation.lead;

  try {
    const supabase = createServiceSupabaseClient();
    const result = await persistCompanyLeadAndNotify({
      insertLead: async () => {
        const { data, error } = await supabase
          .from("company_leads")
          .upsert(lead, { onConflict: "request_id", ignoreDuplicates: true })
          .select("*")
          .maybeSingle();
        if (error) {
          console.error("Company lead persistence failed", { code: error.code });
          throw new Error("company_lead_persistence_failed");
        }
        return data;
      },
      findLead: async () => {
        const { data, error } = await supabase
          .from("company_leads")
          .select("id, notification_status")
          .eq("request_id", lead.request_id)
          .single();
        if (error || !data) {
          console.error("Company lead verification failed", { code: error?.code ?? "missing_record" });
          throw new Error("company_lead_verification_failed");
        }
        return data;
      },
      sendNotification: sendCompanyLeadNotification,
      updateNotification: async (leadId, update) => {
        const { error } = await supabase.from("company_leads").update(update).eq("id", leadId);
        if (error) throw new Error("company_lead_notification_state_update_failed");
      }
    });

    if (result.notificationStatus === "failed") {
      console.error("Company lead notification failed", { reason: "resend_send_failed" });
    }
    if (result.notificationStateUpdateFailed) {
      console.error("Company lead notification state update failed", { reason: "database_update_failed" });
    }

    return NextResponse.json(
      { ok: true, leadId: result.leadId },
      { status: result.created ? 201 : 200 }
    );
  } catch {
    console.error("Company lead request failed", { reason: "persistence_or_verification_failed" });
    return NextResponse.json({ ok: false, error: FAILURE_MESSAGE }, { status: 500 });
  }
}