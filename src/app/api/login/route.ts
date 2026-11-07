import { NextResponse } from "next/server";
import { SESSION_COOKIE, checkCredentials, createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { user?: string; password?: string };
  if (!(await checkCredentials(String(body.user ?? ""), String(body.password ?? "")))) {
    // piccola attesa per scoraggiare i tentativi a raffica
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Nome utente o password non corretti." }, { status: 401 });
  }
  const { value, maxAge } = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return res;
}
