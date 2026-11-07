// Copia di sicurezza completa e invio settimanale per email.
import "server-only";
import { listAudit, logAudit, type AuditEntry } from "./audit";
import { formatLong, parseDate, todayRome } from "./dates";
import { sendPlainEmail, type SendResult } from "./notify";
import { getSettings, listDeadlines } from "./service";
import { getStore } from "./store";
import type { Contract, Deadline, Settings } from "./types";

export interface Backup {
  app: "scadenziario-greco";
  version: 1;
  exportedAt: string;
  deadlines: Deadline[];
  contracts: Contract[];
  settings: Settings;
  audit: AuditEntry[];
}

const LAST_KEY = "backup_last_email";

export async function buildBackup(): Promise<Backup> {
  return {
    app: "scadenziario-greco",
    version: 1,
    exportedAt: new Date().toISOString(),
    deadlines: await listDeadlines(),
    contracts: await getStore().listContracts(),
    settings: await getSettings(),
    audit: await listAudit(),
  };
}

export function backupFileName(b: Backup): string {
  return `scadenziario-anthony-greco-backup-${b.exportedAt.slice(0, 10).replace(/-/g, "")}.json`;
}

export function backupRecipient(s: Settings): string {
  return s.backupEmail || s.recoveryEmail || s.email;
}

export async function lastBackupEmail(): Promise<{ at: string; to: string; ok: boolean; detail: string } | null> {
  return getStore().getKV(LAST_KEY);
}

/** Invia subito il backup per email come allegato. */
export async function emailBackup(reason: "settimanale" | "manuale"): Promise<SendResult> {
  const settings = await getSettings();
  const to = backupRecipient(settings);
  if (!to) return { channel: "email", ok: false, skipped: true, detail: "Nessuna email impostata per il backup" };
  const b = await buildBackup();
  const json = JSON.stringify(b, null, 2);
  const file = backupFileName(b);
  const done = b.deadlines.reduce((n, d) => n + d.history.length, 0);
  const date = formatLong(todayRome());
  const html = `<div style="font-family:Arial,sans-serif;font-size:17px;max-width:560px;margin:auto;padding:24px;color:#0f172a">
<h2 style="color:#1d4ed8;margin:0 0 8px">💾 Backup Scadenziario Anthony Greco</h2>
<p style="color:#475569;margin:0 0 16px">${date} – copia ${reason}</p>
<p>In allegato trovi la copia di sicurezza completa:</p>
<ul>
<li><b>${b.deadlines.length}</b> scadenze (con <b>${done}</b> pagamenti nello storico e le ricevute allegate)</li>
<li><b>${b.contracts.length}</b> contratti di affitto</li>
<li><b>${b.audit.length}</b> voci del diario attività</li>
<li>impostazioni degli avvisi</li>
</ul>
<p><b>Come ripristinare:</b> apri l'app → <i>Impostazioni → Dati e backup → Ripristina da una copia</i> e scegli questo file.</p>
<p style="font-size:13px;color:#64748b">Conserva questa email: il file contiene i tuoi dati personali e fiscali.</p></div>`;
  const r = await sendPlainEmail(to, `💾 Backup Scadenziario Anthony Greco – ${date}`, html, `Backup in allegato (${file}). Per ripristinare: Impostazioni → Dati e backup → Ripristina da una copia.`, [
    { filename: file, content: Buffer.from(json, "utf8").toString("base64") },
  ]);
  await getStore().setKV(LAST_KEY, { at: new Date().toISOString(), to, ok: r.ok, detail: r.detail });
  await logAudit({
    action: "backup",
    actor: "Sistema",
    via: "sistema",
    target: "Dati",
    summary: r.ok ? `Backup ${reason} inviato per email a ${to} (${Math.round(json.length / 1024)} KB)` : `Backup ${reason} NON inviato: ${r.detail}`,
  });
  return r;
}

/** Invio settimanale: nel giorno scelto, al massimo una volta ogni 6 giorni. */
export async function weeklyBackupIfDue(today: string): Promise<SendResult | null> {
  const s = await getSettings();
  if (!s.weeklyBackup || !backupRecipient(s)) return null;
  const weekday = parseDate(today).getUTCDay(); // 0 = domenica
  if (weekday !== s.backupWeekday) return null;
  const last = await lastBackupEmail();
  if (last?.ok && Date.now() - Date.parse(last.at) < 6 * 86_400_000) return null;
  return emailBackup("settimanale");
}
