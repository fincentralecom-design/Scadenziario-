import { json } from "@/lib/http";
import { getSettings } from "@/lib/service";
import { baseUrl, calendarToken } from "@/lib/token";

export const dynamic = "force-dynamic";

/** Link di abbonamento al calendario (solo per utenti che hanno fatto login). */
export async function GET() {
  const url = `${baseUrl((await getSettings()).appUrl)}/api/calendar/feed?k=${calendarToken()}`;
  return json({ https: url, webcal: url.replace(/^https?:/, "webcal:") });
}
