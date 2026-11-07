import { NextResponse, type NextRequest } from "next/server";

/**
 * Protezione opzionale dell'app con password (Basic Auth) se APP_PASSWORD è impostata.
 * Restano pubblici: la pagina di conferma dei magic link (protetta dal token firmato)
 * e l'endpoint del cron (protetto da CRON_SECRET).
 */
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/conferma/") || pathname.startsWith("/api/cron/")) return NextResponse.next();

  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (pass === password) return NextResponse.next();
  }
  return new NextResponse("Accesso riservato", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Scadenziario Pro", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
