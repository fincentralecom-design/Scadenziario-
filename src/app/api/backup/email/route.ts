import { emailBackup, lastBackupEmail } from "@/lib/backup";
import { errorJson, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Ultimo backup inviato per email. */
export async function GET() {
  try {
    return json({ last: await lastBackupEmail() });
  } catch (e) {
    return errorJson(e, 500);
  }
}

/** Invia subito il backup per email. */
export async function POST() {
  try {
    const r = await emailBackup("manuale");
    return json(r, r.ok ? 200 : 400);
  } catch (e) {
    return errorJson(e, 500);
  }
}
