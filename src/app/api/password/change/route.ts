import { actorFrom, logAudit } from "@/lib/audit";
import { configuredUser } from "@/lib/auth";
import { errorJson, json } from "@/lib/http";
import { checkLogin, setPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

/** Cambio password dall'app (serve la password attuale). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { current?: string; next?: string };
    if (!(await checkLogin(configuredUser(), String(body.current ?? "")))) {
      await new Promise((r) => setTimeout(r, 800));
      return json({ error: "La password attuale non è corretta." }, 400);
    }
    await setPassword(String(body.next ?? ""));
    const { actor, device } = actorFrom(req);
    await logAudit({ action: "password", actor, device, via: "app", target: "Accesso", summary: "Password di accesso cambiata" });
    return json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
}
