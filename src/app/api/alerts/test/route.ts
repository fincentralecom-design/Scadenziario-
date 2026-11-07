import { todayRome } from "@/lib/dates";
import { errorJson, json } from "@/lib/http";
import { sendAlert } from "@/lib/notify";
import { getSettings, runDailyCheck, sampleAlert } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Anteprima / test degli avvisi dalla scheda Impostazioni.
 * - action "preview": cosa partirebbe nel giorno indicato (nessun invio)
 * - action "send": invia subito i messaggi di prova (con prefisso [TEST])
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string; date?: string };
    const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayRome();
    const run = await runDailyCheck({ today: date, dryRun: true });
    let messages = run.alerts.map(({ results: _r, ...a }) => a);
    let isSample = false;
    if (!messages.length) {
      const sample = await sampleAlert();
      if (sample) {
        messages = [{ ...sample, alreadySent: false }];
        isSample = true;
      }
    }
    if (body.action !== "send") return json({ date, isSample, messages });

    const settings = await getSettings();
    const results = [];
    for (const m of messages.slice(0, 5)) {
      const test = { ...m, subject: `[TEST] ${m.subject}`, sms: `[TEST] ${m.sms}`, whatsapp: `[TEST]\n${m.whatsapp}` };
      results.push({ subject: test.subject, results: await sendAlert(test, settings) });
    }
    return json({ date, isSample, messages, sent: results });
  } catch (e) {
    return errorJson(e, 500);
  }
}
