import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processDueApplicationEmails } from "@/lib/email/application-email-queue";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  if (!env.applicationEmailRetrySecret) return false;
  return request.headers.get("authorization") === `Bearer ${env.applicationEmailRetrySecret}`;
}

export async function POST(request: Request) {
  if (!env.applicationEmailRetrySecret) {
    return NextResponse.json({ error: "A feldolgozó nincs konfigurálva." }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 401 });

  try {
    const results = await processDueApplicationEmails({ limit: 20 });
    return NextResponse.json({ ok: true, processed: results.length });
  } catch {
    console.error("Application email retry worker failed", { reason: "worker_processing_failed" });
    return NextResponse.json({ error: "A feldolgozás átmenetileg sikertelen." }, { status: 503 });
  }
}
