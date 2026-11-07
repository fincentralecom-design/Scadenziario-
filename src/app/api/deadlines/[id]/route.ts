import { errorJson, json } from "@/lib/http";
import { sanitizeDeadline } from "@/lib/service";
import { getStore } from "@/lib/store";
import type { Deadline } from "@/lib/types";
import { actorFrom, diffDeadline, logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const store = getStore();
    const existing = await store.getDeadline(id);
    if (!existing) return json({ error: "Scadenza non trovata" }, 404);
    const d = sanitizeDeadline((await req.json()) as Partial<Deadline>, existing);
    await store.upsertDeadlines([d]);
    const changes = diffDeadline(existing, d);
    if (changes.length) {
      const { actor, device } = actorFrom(req);
      const onlyActive = changes.length === 1 && changes[0].field === "Attiva";
      await logAudit({
        action: onlyActive ? (d.active ? "riattivata" : "disattivata") : "modificata",
        actor,
        device,
        via: "app",
        target: d.title,
        targetId: d.id,
        summary: onlyActive ? (d.active ? "Scadenza riattivata" : "Scadenza disattivata") : `Modificati: ${changes.map((c) => c.field).join(", ")}`,
        changes: onlyActive ? undefined : changes,
      });
    }
    return json(d);
  } catch (e) {
    return errorJson(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const old = await getStore().getDeadline(id);
    await getStore().deleteDeadlines([id]);
    if (old) {
      const { actor, device } = actorFrom(req);
      await logAudit({ action: "eliminata", actor, device, via: "app", target: old.title, targetId: id, summary: `Scadenza eliminata (aveva ${old.history.length} completamenti nello storico)` });
    }
    return json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
}
