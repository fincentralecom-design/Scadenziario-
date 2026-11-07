import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authDisabled, verifySession } from "@/lib/auth";

/** Percorsi accessibili senza login. */
const PUBLIC = [
  "/login",
  "/api/login",
  "/api/logout",
  "/conferma/", // protetta dal token firmato nel link
  "/api/cron/", // protetta da CRON_SECRET
];

/**
 * Accesso all'app solo dopo il login (utente e password).
 * Restano pubblici la pagina di login, i Magic Link di conferma e il cron.
 */
export async function middleware(req: NextRequest) {
  if (authDisabled()) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || (p.endsWith("/") && pathname.startsWith(p)))) return NextResponse.next();

  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Accesso scaduto: ricarica la pagina ed entra di nuovo." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname + search)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|apple-touch-icon.png|manifest.webmanifest).*)"],
};
