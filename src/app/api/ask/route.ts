import { askScadenziario } from "@/lib/ask";
import type { ChatTurn } from "@/lib/assistant";
import { todayRome } from "@/lib/dates";
import { errorJson, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Domande libere sui dati dello scadenziario. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { messages?: ChatTurn[] };
    const turns = (body.messages ?? [])
      .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
      .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));
    if (!turns.length || turns[turns.length - 1].role !== "user") return json({ error: "Scrivi una domanda" }, 400);
    return json(await askScadenziario(turns, todayRome()));
  } catch (e) {
    return errorJson(e, 500);
  }
}
