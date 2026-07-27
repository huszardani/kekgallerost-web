export const legacyJobRedirects = {
  "fuvarszervezo-nagytarcsa": "/allas/fuvarszervezo-nagytarcsa"
} as const;

export const retiredLegacyJobSlugs = [
  "raktari-komissiozo-gyal",
  "operator-szekesfehervar",
  "targoncavezeto-tatabanya",
  "sofor-budapest",
  "karbantarto-gyor",
  "vendeglatas-balaton"
] as const;

type LegacyJobResolution =
  | { kind: "pass" }
  | { kind: "redirect"; destination: string }
  | { kind: "gone" }
  | { kind: "not-found" };

const retiredSlugs = new Set<string>(retiredLegacyJobSlugs);

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function withSearch(pathname: string, searchParams: URLSearchParams) {
  const search = searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function resolveLegacyJobRequest(pathname: string, requestSearchParams: URLSearchParams): LegacyJobResolution {
  if (pathname === "/allasok" || pathname === "/allasok/") return { kind: "pass" };
  if (!pathname.startsWith("/allasok/")) return { kind: "pass" };

  const parts = pathname
    .slice("/allasok/".length)
    .split("/")
    .filter(Boolean)
    .map(decodePathSegment);

  if (parts.length === 2 && parts[1].toLowerCase() === "index.html") parts.pop();
  if (parts.length !== 1 || !parts[0]) return { kind: "not-found" };

  let slug = parts[0];
  const searchParams = new URLSearchParams(requestSearchParams);

  if (slug.toLowerCase() === "index.html") {
    return { kind: "redirect", destination: withSearch("/allasok", searchParams) };
  }

  if (slug === "reszletek") {
    slug = searchParams.get("allas") || searchParams.get("slug") || "";
    searchParams.delete("allas");
    searchParams.delete("slug");
    if (!slug) return { kind: "not-found" };
  }

  const destination = legacyJobRedirects[slug as keyof typeof legacyJobRedirects];
  if (destination) return { kind: "redirect", destination: withSearch(destination, searchParams) };
  if (retiredSlugs.has(slug)) return { kind: "gone" };
  return { kind: "not-found" };
}
