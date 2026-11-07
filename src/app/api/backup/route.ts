import { actorFrom, listAudit, logAudit, replaceAudit, type AuditEntry } from "@/lib/audit";
import { errorJson, json } from "@/lib/http";
import { getSettings, listDeadlines, saveSettings } from "@/lib/service";
import { getStore } from "@/lib/store";
import type { Contract, Deadline, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Backup {
  app: "scadenziario-greco";
  version: 1;
  exportedAt: string;
  deadlines: Deadline[];
  contracts: Contract[];
  settings: Settings;
  audit: AuditEntry[];
}

/** Copia di sicurezza completa (scadenze, storico, contratti, impostazioni, diario). */
export async function GET() {
  try {
    const backup: Backup = {
      app: "scadenziario-greco",
      version: 1,
      exportedAt: new Date().toISOString(),
      deadlines: await listDeadlines(),
      contracts: await getStore().listContracts(),
      settings: await getSettings(),
      audit: await listAudit(),
    };
    const day = backup.exportedAt.slice(0, 10).replace(/-/g, "");
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="scadenziario-greco-backup-${day}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorJson(e, 500);
  }
}

/** Ripristino da una copia: sostituisce scadenze, contratti e impostazioni con quelli del file. */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Partial<Backup>;
    if (b.app !== "scadenziario-greco" || !Array.isArray(b.deadlines) || !Array.isArray(b.contracts)) {
      return json({ error: "Il file non è una copia valida dello Scadenziario." }, 400);
    }
    const store = getStore();
    const keepD = new Set(b.deadlines.map((d) => d.id));
    const keepC = new Set(b.contracts.map((c) => c.id));
    await store.deleteDeadlines((await store.listDeadlines()).filter((d) => !keepD.has(d.id)).map((d) => d.id));
    for (const c of await store.listContracts()) if (!keepC.has(c.id)) await store.deleteContract(c.id);
    await store.upsertDeadlines(b.deadlines);
    for (const c of b.contracts) await store.upsertContract(c);
    if (b.settings) await saveSettings(b.settings);
    if (Array.isArray(b.audit)) await replaceAudit(b.audit);
    const { actor, device } = actorFrom(req);
    await logAudit({
      action: "backup",
      actor,
      device,
      via: "app",
      target: "Dati",
      summary: `Ripristinata la copia del ${b.exportedAt ? new Date(b.exportedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" }) : "?"} (${b.deadlines.length} scadenze, ${b.contracts.length} contratti)`,
    });
    return json({ ok: true, deadlines: b.deadlines.length, contracts: b.contracts.length });
  } catch (e) {
    return errorJson(e);
  }
}
