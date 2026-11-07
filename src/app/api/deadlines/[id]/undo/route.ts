import { errorJson, json } from "@/lib/http";
import { undoById } from "@/lib/service";
import { actorFrom, logAudit } from "@/lib/audit";
import { formatShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const d = await undoById((await params).id);
    if (!d) return json({ error: "Scadenza non trovata" }, 404);
    const { actor, device } = actorFrom(req);
    await logAudit({ action: "annullata", actor, device, via: "app", target: d.title, targetId: d.id, summary: `Annullato l'ultimo completamento: di nuovo da fare per il ${formatShort(d.dueDate)}` });
    return json(d);
  } catch (e) {
    return errorJson(e);
  }
}
