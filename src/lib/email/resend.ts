import "server-only";

import { Resend } from "resend";
import { env } from "@/lib/env";

export function createResendClient() {
  if (!env.resendApiKey) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }

  return new Resend(env.resendApiKey);
}

export function getEmailFromAddress() {
  return env.emailFrom;
}

type IdempotentEmail = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendIdempotentEmail(message: IdempotentEmail, idempotencyKey: string) {
  if (!env.resendApiKey) throw new Error("Missing RESEND_API_KEY environment variable.");
  const { replyTo, ...payload } = message;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ ...payload, reply_to: replyTo }),
  });
  const body = await response.json() as { id?: string; name?: string; message?: string; statusCode?: number };
  if (!response.ok) return { data: null, error: { ...body, statusCode: body.statusCode ?? response.status } };
  return { data: { id: body.id ?? null }, error: null };
}
