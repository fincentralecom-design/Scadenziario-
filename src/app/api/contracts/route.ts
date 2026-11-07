import { errorJson, json } from "@/lib/http";
import { saveContract } from "@/lib/service";
import { getStore } from "@/lib/store";
import type { Contract } from "@/lib/types";
import { actorFrom, logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(await getStore().listContracts());
  } catch (e) {
    return errorJson(e, 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Contract>;
    const r = await saveContract({ ...body, id: undefined });
    const { actor, device } = actorFrom(req);
    await logAudit({ action: "contratto", actor, device, via: "app", target: `${r.contract.tenant} – ${r.contract.property}`, targetId: r.contract.id, summary: `Nuovo contratto: create ${r.deadlines.length} scadenze collegate` });
    return json(r, 201);
  } catch (e) {
    return errorJson(e);
  }
}
