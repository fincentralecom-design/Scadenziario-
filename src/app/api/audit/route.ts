import { listAudit } from "@/lib/audit";
import { errorJson, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Diario attività (le voci più recenti per prime). */
export async function GET() {
  try {
    return json(await listAudit());
  } catch (e) {
    return errorJson(e, 500);
  }
}
