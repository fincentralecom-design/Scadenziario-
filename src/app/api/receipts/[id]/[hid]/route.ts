import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Restituisce la ricevuta allegata a un completamento. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; hid: string }> }) {
  const { id, hid } = await params;
  const d = await getStore().getDeadline(id);
  const h = d?.history.find((x) => x.id === hid);
  const m = h?.receiptData?.match(/^data:([^;]+);base64,(.*)$/);
  if (!h || !m) return new Response("Ricevuta non trovata", { status: 404 });
  const name = (h.receiptName || "ricevuta").replace(/[^\w.\- ]/g, "_");
  return new Response(Buffer.from(m[2], "base64"), {
    headers: {
      "Content-Type": m[1],
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
