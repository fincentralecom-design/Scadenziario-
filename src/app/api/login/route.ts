import { NextResponse } from "next/server";
import { actorFrom, logAudit } from "@/lib/audit";
import { SESSION_COOKIE, createSession } from "@/lib/auth";
import { checkLogin } from "@/lib/password";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { user?: string; password?: string };
  if (!(await checkLogin(String(body.user ?? ""), String(body.password ?? "")))) {
    // piccola attesa per scoraggiare i tentativi a raffica
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Nome utente o password non corretti." }, { status: 401 });
  }
  const { actor, device } = actorFrom(req);
  await logAudit({ action: "accesso", actor, device, via: "app", target: "Accesso", summary: `Accesso all'app da ${device}` });
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
