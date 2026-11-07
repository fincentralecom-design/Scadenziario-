import { errorJson, json } from "@/lib/http";
import { undoById } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const d = await undoById((await params).id);
    if (!d) return json({ error: "Scadenza non trovata" }, 404);
    return json(d);
  } catch (e) {
    return errorJson(e);
  }
}
