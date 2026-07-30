type SiteverifyResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

export const TURNSTILE_FAILURE_MESSAGE = "A biztonsági ellenőrzés nem sikerült vagy lejárt. Kérjük, próbáld újra.";

export async function verifyTurnstile({
  token,
  expectedAction,
  remoteIp,
  environment = process.env.VERCEL_ENV,
  secret = process.env.TURNSTILE_SECRET_KEY,
  fetchImpl = fetch,
}: {
  token: string;
  expectedAction: string;
  remoteIp?: string | null;
  environment?: string;
  secret?: string;
  fetchImpl?: typeof fetch;
}) {
  if (!token || token.length > 2048 || !secret) return { ok: false, message: TURNSTILE_FAILURE_MESSAGE };
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(4_000),
    });
    const result = await response.json() as SiteverifyResponse;
    const expectedHostname = environment === "production" ? "kekgallerost.hu" : undefined;
    if (!response.ok || !result.success || result.action !== expectedAction || (expectedHostname && result.hostname !== expectedHostname)) {
      return { ok: false, message: TURNSTILE_FAILURE_MESSAGE };
    }
    return { ok: true as const };
  } catch {
    return { ok: false, message: TURNSTILE_FAILURE_MESSAGE };
  }
}

export function requestIp(request: Request) {
  return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? null;
}
