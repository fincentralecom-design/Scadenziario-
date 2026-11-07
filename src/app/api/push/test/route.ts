import { errorJson, json } from "@/lib/http";
import { sendPushToAll } from "@/lib/push";
import { getSettings } from "@/lib/service";
import { baseUrl } from "@/lib/token";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const s = await getSettings();
    const result = await sendPushToAll({
      title: "🔔 Prova notifica – Scadenziario Anthony Greco",
      body: "Le notifiche funzionano! Riceverai qui gli avvisi 3 giorni prima e il giorno della scadenza.",
      url: `${baseUrl(s.appUrl)}/`,
      tag: "test",
    });
    return json(result);
  } catch (e) {
    return errorJson(e, 500);
  }
}
