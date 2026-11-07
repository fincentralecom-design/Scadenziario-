import { errorJson, json } from "@/lib/http";
import { deleteContract, saveContract } from "@/lib/service";
import type { Contract } from "@/lib/types";
import { actorFrom, logAudit } from "@/lib/audit";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Partial<Contract>;
    const r = await saveContract({ ...body, id });
    const { actor, device } = actorFrom(req);
    await logAudit({ action: "contratto", actor, device, via: "app", target: `${r.contract.tenant} – ${r.contract.property}`, targetId: id, summary: "Contratto modificato: scadenze ricalcolate" });
    return json(r);
  } catch (e) {
    return errorJson(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const old = await getStore().getContract(id);
    await deleteContract(id);
    const { actor, device } = actorFrom(req);
    await logAudit({ action: "contratto", actor, device, via: "app", target: old ? `${old.tenant} – ${old.property}` : "Contratto", targetId: id, summary: "Contratto eliminato con le sue scadenze" });
    return json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
}
