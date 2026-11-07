import { errorJson, json } from "@/lib/http";
import { providerStatus } from "@/lib/notify";
import { getSettings, lastRuns, saveSettings } from "@/lib/service";
import { baseUrl } from "@/lib/token";
import type { Settings } from "@/lib/types";
import { actorFrom, logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSettings();
    return json({
      settings,
      providers: providerStatus(),
      effectiveUrl: baseUrl(settings.appUrl),
      cronProtected: !!process.env.CRON_SECRET,
      magicSecretSet: !!(process.env.MAGIC_LINK_SECRET || process.env.CRON_SECRET),
      runs: await lastRuns(),
    });
  } catch (e) {
    return errorJson(e, 500);
  }
}

export async function PUT(req: Request) {
  try {
    const b = (await req.json()) as Partial<Settings>;
    const clean: Partial<Settings> = {
      recipientName: String(b.recipientName ?? "").slice(0, 80),
      email: String(b.email ?? "").trim().slice(0, 200),
      whatsapp: String(b.whatsapp ?? "").trim().slice(0, 30),
      sms: String(b.sms ?? "").trim().slice(0, 30),
      channels: { email: !!b.channels?.email, whatsapp: !!b.channels?.whatsapp, sms: !!b.channels?.sms, push: !!b.channels?.push },
      overdueReminder: !!b.overdueReminder,
      appUrl: String(b.appUrl ?? "").trim().slice(0, 300),
      recoveryEmail: String(b.recoveryEmail ?? "").trim().slice(0, 200),
    };
    if (clean.recoveryEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean.recoveryEmail)) throw new Error("Email di recupero non valida");
    const before = await getSettings();
    if (clean.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean.email)) throw new Error("Email non valida");
    const saved = await saveSettings(clean);
    const labels: Record<string, string> = { recipientName: "Nome destinatario", email: "Email", whatsapp: "WhatsApp", sms: "SMS", overdueReminder: "Sollecito", appUrl: "Indirizzo app", recoveryEmail: "Email di recupero" };
    const changes = Object.entries(labels)
      .filter(([k]) => JSON.stringify(before[k as keyof Settings]) !== JSON.stringify(saved[k as keyof Settings]))
      .map(([k, field]) => ({ field, from: String(before[k as keyof Settings] || "—"), to: String(saved[k as keyof Settings] || "—") }));
    for (const ch of ["email", "whatsapp", "sms", "push"] as const) {
      if (before.channels[ch] !== saved.channels[ch]) changes.push({ field: `Canale ${ch}`, from: before.channels[ch] ? "attivo" : "spento", to: saved.channels[ch] ? "attivo" : "spento" });
    }
    if (changes.length) {
      const { actor, device } = actorFrom(req);
      await logAudit({ action: "impostazioni", actor, device, via: "app", target: "Impostazioni avvisi", summary: `Modificati: ${changes.map((c) => c.field).join(", ")}`, changes });
    }
    return json(saved);
  } catch (e) {
    return errorJson(e);
  }
}
