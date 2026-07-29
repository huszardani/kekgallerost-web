import { NextResponse } from "next/server";

export function GET() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return NextResponse.json({ error: "Turnstile nincs konfigurálva." }, { status: 503 });
  return NextResponse.json({ siteKey }, { headers: { "cache-control": "no-store" } });
}
