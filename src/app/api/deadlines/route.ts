import { errorJson, json } from "@/lib/http";
import { listDeadlines, sanitizeDeadline } from "@/lib/service";
import { getStore } from "@/lib/store";
import { todayRome } from "@/lib/dates";
import type { Deadline } from "@/lib/types";
import { actorFrom, logAudit } from "@/lib/audit";
import { formatShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = getStore();
    const [deadlines, contracts] = await Promise.all([listDeadlines(), store.listContracts()]);
    // Le ricevute allegate non viaggiano nell'elenco: si scaricano da /api/receipts.
    const light = deadlines.map((d) => ({
      ...d,
      history: d.history.map(({ receiptData, ...h }) => ({ ...h, hasReceipt: !!receiptData })),
    }));
    return json({ today: todayRome(), deadlines: light, contracts, storage: { kind: store.kind, persistent: store.persistent } });
  } catch (e) {
    return errorJson(e, 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Deadline>;
    const d = sanitizeDeadline({ ...body, id: undefined });
    await getStore().upsertDeadlines([d]);
    const { actor, device } = actorFrom(req);
    await logAudit({ action: "creata", actor, device, via: "app", target: d.title, targetId: d.id, summary: `Nuova scadenza per il ${formatShort(d.dueDate)}` });
    return json(d, 201);
  } catch (e) {
    return errorJson(e);
  }
}
