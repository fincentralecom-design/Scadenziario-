import { todayRome } from "@/lib/dates";
import { buildIcs } from "@/lib/ics";
import { getSettings, listDeadlines } from "@/lib/service";
import { baseUrl } from "@/lib/token";

export const dynamic = "force-dynamic";

/** File .ics da importare: tutte le scadenze dei prossimi 12 mesi, oppure una sola (?id=). */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const settings = await getSettings();
  let list = await listDeadlines();
  if (id) list = list.filter((d) => d.id === id);
  const ics = buildIcs(list, todayRome(), id ? 1 : 12, baseUrl(settings.appUrl), !!id);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${id ? "scadenza" : "scadenziario-greco"}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
