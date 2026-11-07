import { logAudit } from "@/lib/audit";
import { errorJson, json } from "@/lib/http";
import { isValidResetToken, setPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

/** Imposta una nuova password usando il link ricevuto per email. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; next?: string };
    if (!(await isValidResetToken(String(body.token ?? "")))) {
      return json({ error: "Il link non è valido o è scaduto. Richiedine uno nuovo dalla pagina di accesso." }, 400);
    }
    await setPassword(String(body.next ?? ""));
    await logAudit({ action: "password", actor: "Link di recupero", via: "link", target: "Accesso", summary: "Password reimpostata con il link ricevuto per email" });
    return json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
}
