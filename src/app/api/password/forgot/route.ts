import { logAudit } from "@/lib/audit";
import { configuredUser } from "@/lib/auth";
import { json } from "@/lib/http";
import { sendPlainEmail } from "@/lib/notify";
import { createResetToken } from "@/lib/password";
import { getSettings } from "@/lib/service";
import { baseUrl } from "@/lib/token";

export const dynamic = "force-dynamic";

const GENERIC = "Se il nome utente è corretto, abbiamo inviato un link all'email di recupero impostata. Controlla anche lo spam.";

/** Password dimenticata: invia un link (valido 1 ora) all'email di recupero. Risposta sempre uguale. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { user?: string };
  const user = String(body.user ?? "").trim().toLowerCase();
  const settings = await getSettings();
  const to = settings.recoveryEmail || settings.email;
  if (user !== configuredUser() || !to) {
    await new Promise((r) => setTimeout(r, 600));
    return json({ ok: true, message: GENERIC, noEmail: user === configuredUser() && !to });
  }
  const token = await createResetToken();
  if (token) {
    const link = `${baseUrl(settings.appUrl)}/reset-password?t=${token}`;
    const html = `<div style="font-family:Arial,sans-serif;font-size:18px;max-width:560px;margin:auto;padding:24px">
<h2 style="color:#1d4ed8">Scadenziario Anthony Greco – nuova password</h2>
<p>È stato chiesto di reimpostare la password di accesso.</p>
<p style="text-align:center;margin:28px 0"><a href="${link}" style="background:#15803d;color:#fff;padding:16px 28px;border-radius:12px;text-decoration:none;font-weight:bold">Scegli una nuova password</a></p>
<p style="font-size:14px;color:#64748b">Il link vale 1 ora. Se non sei stato tu, ignora questa email: la password attuale resta valida.</p></div>`;
    const r = await sendPlainEmail(to, "🔑 Scadenziario Anthony Greco – reimposta la password", html, `Reimposta la password (link valido 1 ora): ${link}`);
    await logAudit({
      action: "password",
      actor: "Sistema",
      via: "sistema",
      target: "Accesso",
      summary: r.ok ? `Inviato link di recupero password a ${to}` : `Recupero password non inviato: ${r.detail}`,
    });
    if (!r.ok) return json({ ok: false, message: "Non è stato possibile inviare l'email: il servizio email non è configurato. Chiedi a chi gestisce il sito." });
  }
  return json({ ok: true, message: GENERIC });
}
