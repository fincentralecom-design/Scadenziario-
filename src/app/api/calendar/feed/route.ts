import { todayRome } from "@/lib/dates";
import { buildIcs } from "@/lib/ics";
import { getSettings, listDeadlines } from "@/lib/service";
import { baseUrl, calendarToken } from "@/lib/token";

export const dynamic = "force-dynamic";

/**
 * Calendario in abbonamento (webcal://): il Calendario dell'iPhone lo riscarica da solo,
 * quindi nuove scadenze e completamenti si aggiornano automaticamente.
 * Accessibile senza login ma solo con il token segreto nel link.
 */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("k") !== calendarToken()) return new Response("Non autorizzato", { status: 401 });
  const settings = await getSettings();
  const ics = buildIcs(await listDeadlines(), todayRome(), 12, baseUrl(settings.appUrl));
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
}
