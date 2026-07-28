import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveLegacyJobRequest } from "@/lib/legacy-job-routes";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/allasok")) {
    const legacyRoute = resolveLegacyJobRequest(request.nextUrl.pathname, request.nextUrl.searchParams);
    if (legacyRoute.kind === "redirect") {
      return NextResponse.redirect(new URL(legacyRoute.destination, request.url), 308);
    }
    if (legacyRoute.kind === "gone") {
      return new NextResponse(
        "<!doctype html><html lang=\"hu\"><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex,follow\"><title>Az álláshirdetés megszűnt</title></head><body><main><h1>Ez az álláshirdetés már nem elérhető.</h1><p><a href=\"/allasok\">Aktuális állások megtekintése</a></p></main></body></html>",
        { status: 410, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, follow" } }
      );
    }
    if (legacyRoute.kind === "not-found") {
      return new NextResponse(
        "<!doctype html><html lang=\"hu\"><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex,follow\"><title>Az oldal nem található</title></head><body><main><h1>Az oldal nem található.</h1><p><a href=\"/allasok\">Aktuális állások megtekintése</a></p></main></body></html>",
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, follow" } }
      );
    }
  }

  if (request.nextUrl.pathname !== "/" && request.nextUrl.pathname.endsWith("/")) {
    const normalizedUrl = new URL(request.url);
    normalizedUrl.pathname = normalizedUrl.pathname.slice(0, -1);
    return NextResponse.redirect(normalizedUrl, 308);
  }

  const protectedPath = request.nextUrl.pathname.startsWith("/admin")
    || request.nextUrl.pathname.startsWith("/partner");
  const authenticationPath = protectedPath
    || request.nextUrl.pathname === "/bejelentkezes"
    || request.nextUrl.pathname === "/uj-jelszo";
  if (!authenticationPath) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { data } = await supabase.auth.getUser();
  if (protectedPath && !data.user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/bejelentkezes";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/allasok/:path*", "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};

