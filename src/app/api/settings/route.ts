import { errorJson, json } from "@/lib/http";
import { providerStatus } from "@/lib/notify";
import { getSettings, lastRuns, saveSettings } from "@/lib/service";
import { baseUrl } from "@/lib/token";
import type { Settings } from "@/lib/types";

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
      channels: { email: !!b.channels?.email, whatsapp: !!b.channels?.whatsapp, sms: !!b.channels?.sms },
      overdueReminder: !!b.overdueReminder,
      appUrl: String(b.appUrl ?? "").trim().slice(0, 300),
    };
    if (clean.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean.email)) throw new Error("Email non valida");
    return json(await saveSettings(clean));
  } catch (e) {
    return errorJson(e);
  }
}
