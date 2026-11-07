import { errorJson, json } from "@/lib/http";
import { sanitizeDeadline } from "@/lib/service";
import { getStore } from "@/lib/store";
import type { Deadline } from "@/lib/types";

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
    return json(d);
  } catch (e) {
    return errorJson(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await getStore().deleteDeadlines([id]);
    return json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
}
