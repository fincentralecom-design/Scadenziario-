import { errorJson, json } from "@/lib/http";
import { addSubscription, listSubscriptions, removeSubscription, vapidKeys } from "@/lib/push";
import type { PushSubscription } from "web-push";

export const dynamic = "force-dynamic";

/** Chiave pubblica per iscriversi e numero di dispositivi iscritti. */
export async function GET() {
  try {
    const { publicKey } = await vapidKeys();
    return json({ publicKey, devices: (await listSubscriptions()).length });
  } catch (e) {
    return errorJson(e, 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { subscription: PushSubscription; device?: string };
    return json({ devices: await addSubscription(body.subscription, body.device) });
  } catch (e) {
    return errorJson(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { endpoint?: string };
    if (body.endpoint) await removeSubscription(body.endpoint);
    return json({ devices: (await listSubscriptions()).length });
  } catch (e) {
    return errorJson(e);
  }
}
