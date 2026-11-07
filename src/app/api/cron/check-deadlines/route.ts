import { hourRome } from "@/lib/dates";
import { json, errorJson } from "@/lib/http";
import { runDailyCheck } from "@/lib/service";
import { weeklyBackupIfDue } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALERT_HOUR = Number(process.env.ALERT_HOUR_ROME ?? 8);

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const url = new URL(req.url);
  return req.headers.get("authorization") === `Bearer ${secret}` || url.searchParams.get("key") === secret;
}

/**
 * Controllo giornaliero delle scadenze (Vercel Cron, cron di sistema, cron-job.org...).
 * Vercel lo chiama alle 06:30 e 07:30 UTC: in ora solare e legale una delle due
 * corrisponde alle 08:30 italiane. Prima delle 8:00 italiane non invia nulla
 * (salvo ?force=1) e ogni avviso viene inviato una sola volta al giorno.
 *
 * Parametri: ?force=1 ignora l'orario, ?dryRun=1 non invia, ?date=YYYY-MM-DD simula un giorno.
 */
async function handle(req: Request) {
  if (!authorized(req)) return json({ error: "Non autorizzato" }, 401);
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    const dryRun = url.searchParams.get("dryRun") === "1";
    const date = url.searchParams.get("date") || undefined;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "Data non valida" }, 400);
    const hour = hourRome();
    if (!force && !date && hour < ALERT_HOUR) {
      return json({ skipped: true, reason: `Sono le ${hour} in Italia: il controllo parte dalle ${ALERT_HOUR}:00.` });
    }
    const res = await runDailyCheck({ today: date, dryRun });
    // Backup settimanale per email (solo nei controlli reali, non nelle simulazioni).
    const backup = !dryRun && !date ? await weeklyBackupIfDue(res.today).catch((e: unknown) => ({ ok: false, detail: String(e) })) : null;
    return json({
      today: res.today,
      dryRun: res.dryRun,
      count: res.alerts.length,
      backup,
      alerts: res.alerts.map((a) => ({ subject: a.subject, kind: a.kind, dueDate: a.dueDate, alreadySent: a.alreadySent, results: a.results })),
    });
  } catch (e) {
    return errorJson(e, 500);
  }
}

export const GET = handle;
export const POST = handle;
