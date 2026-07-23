import { NextResponse } from "next/server";
import { validateCompanyLead } from "@/lib/company-leads";
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
    const { data: inserted, error: insertError } = await supabase
      .from("company_leads")
      .upsert(lead, { onConflict: "request_id", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();

    if (insertError) {
      console.error("Company lead persistence failed", { code: insertError.code });
      return NextResponse.json({ ok: false, error: FAILURE_MESSAGE }, { status: 500 });
    }

    let leadId = inserted?.id;
    if (!leadId) {
      const { data: existing, error: verifyError } = await supabase
        .from("company_leads")
        .select("id")
        .eq("request_id", lead.request_id)
        .single();

      if (verifyError || !existing) {
        console.error("Company lead verification failed", { code: verifyError?.code ?? "missing_record" });
        return NextResponse.json({ ok: false, error: FAILURE_MESSAGE }, { status: 500 });
      }
      leadId = existing.id;
    }

    return NextResponse.json({ ok: true, leadId }, { status: 201 });
  } catch (error) {
    console.error("Company lead request failed", { reason: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, error: FAILURE_MESSAGE }, { status: 500 });
  }
}