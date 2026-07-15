import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createResendClient, getEmailFromAddress } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

function extractEmail(value: string) {
  const match = value.match(/<([^>]+)>/);
  return match?.[1] ?? value;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = env.emailTestToken;

  if (!expectedToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "EMAIL_TEST_TOKEN is not configured."
      },
      { status: 501 }
    );
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized."
      },
      { status: 401 }
    );
  }

  if (!env.resendApiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "RESEND_API_KEY is not configured."
      },
      { status: 501 }
    );
  }

  const to = env.emailTestTo ?? extractEmail(getEmailFromAddress());
  const resend = createResendClient();
  const result = await resend.emails.send({
    from: getEmailFromAddress(),
    to,
    subject: "Kekgallerost.hu email smoke test",
    text: "Resend email sending is configured for kekgallerost-web."
  });

  if (result.error) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error.message
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: result.data?.id ?? null,
    to
  });
}