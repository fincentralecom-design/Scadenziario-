import { errorJson, json } from "@/lib/http";
import { completeById } from "@/lib/service";
import type { CompletionInput } from "@/lib/deadlines";

export const dynamic = "force-dynamic";
const MAX_RECEIPT = 2_800_000; // ~2 MB di file in base64

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = ((await req.json().catch(() => ({}))) ?? {}) as CompletionInput;
    if (body.receiptData && body.receiptData.length > MAX_RECEIPT) {
      return json({ error: "Ricevuta troppo grande (max 2 MB). Usa una foto più leggera o un PDF." }, 413);
    }
    const d = await completeById(id, {
      note: body.note,
      amountPaid: typeof body.amountPaid === "number" ? body.amountPaid : null,
      receiptName: body.receiptName,
      receiptData: body.receiptData,
      completedAt: body.completedAt,
      via: "app",
    });
    if (!d) return json({ error: "Scadenza non trovata" }, 404);
    return json(d);
  } catch (e) {
    return errorJson(e);
  }
}
