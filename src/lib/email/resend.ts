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