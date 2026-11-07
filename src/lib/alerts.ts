// Motore di allerta: decide QUALI avvisi inviare oggi e ne compone il testo.
import { formatLong, formatShort } from "./dates";
import { daysLeft, effectiveDate, f24CodeFor, formatEuro, shiftReason } from "./deadlines";
import type { Deadline, Settings } from "./types";

export type AlertKind = "preavviso" | "oggi" | "sollecito";

export interface AlertMessage {
  deadlineId: string;
  kind: AlertKind;
  /** Chiave di deduplica: stessa scadenza, stessa data, stesso tipo, stesso giorno. */
  key: string;
  subject: string;
  emailHtml: string;
  emailText: string;
  whatsapp: string;
  sms: string;
  link: string;
  dueDate: string;
  daysLeft: number;
}

/** Regola: avviso a -3 giorni e il giorno stesso; sollecito opzionale se scaduta. */
export function alertKindFor(d: Deadline, today: string, overdueReminder: boolean): AlertKind | null {
  if (!d.active || d.status !== "todo") return null;
  const n = daysLeft(d, today);
  if (n === 3) return "preavviso";
  if (n === 0) return "oggi";
  if (n < 0 && overdueReminder) return "sollecito";
  return null;
}

export function subjectFor(kind: AlertKind, d: Deadline, n: number): string {
  if (kind === "preavviso") return `⏳ PREAVVISO (-3 giorni): ${d.title}`;
  if (kind === "oggi") return `🚨 SCADE OGGI: ${d.title}`;
  const late = Math.abs(n);
  return `❗ SCADUTA da ${late} ${late === 1 ? "giorno" : "giorni"}: ${d.title}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildAlert(d: Deadline, kind: AlertKind, today: string, settings: Settings, link: string): AlertMessage {
  const due = effectiveDate(d);
  const n = daysLeft(d, today);
  const subject = subjectFor(kind, d, n);
  const code = f24CodeFor(d);
  const shifted = shiftReason(d);
  const amount = d.amount ? formatEuro(d.amount) : null;
  const name = settings.recipientName || "";
  const when =
    kind === "oggi" ? "OGGI" : kind === "preavviso" ? `tra 3 giorni` : `il ${formatShort(due)} (SCADUTA)`;

  const lines: string[] = [
    `${name ? `Ciao ${name}, ` : ""}${kind === "sollecito" ? "promemoria: questa scadenza non è ancora stata confermata." : `scadenza ${when}.`}`,
    "",
    `📌 ${d.title}`,
    `📅 Entro: ${formatLong(due)}${shifted ? ` (spostata dal ${formatShort(d.dueDate)}: ${shifted})` : ""}`,
  ];
  if (amount) lines.push(`💶 Importo: ${amount}`);
  if (code) lines.push(`🧾 Codice tributo F24: ${code}`);
  if (d.portal) lines.push(`🌐 Dove: ${d.portal}`);
  if (d.description) lines.push("", d.description);
  if (d.specialRule) lines.push("", `ℹ️ ${d.specialRule}`);
  if (d.notes) lines.push(`📝 ${d.notes}`);
  lines.push("", `✅ Quando hai fatto, conferma con un tocco:`, link);
  const emailText = lines.join("\n");

  const whatsapp = [
    `*${subject}*`,
    "",
    `📅 Entro: *${formatLong(due)}*`,
    amount ? `💶 Importo: *${amount}*` : null,
    code ? `🧾 Codice F24: *${code}*` : null,
    d.portal ? `🌐 Dove: ${d.portal}` : null,
    d.specialRule ? `ℹ️ ${d.specialRule}` : null,
    "",
    `✅ Fatto? Conferma qui: ${link}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const shortTitle = d.title.length > 60 ? `${d.title.slice(0, 57)}...` : d.title;
  const prefix = kind === "preavviso" ? "PREAVVISO -3gg" : kind === "oggi" ? "SCADE OGGI" : "SCADUTA";
  const sms = `${prefix}: ${shortTitle} entro ${formatShort(due)}${code ? ` - F24 ${code.split(" ")[0]}` : ""}${amount ? ` - ${amount}` : ""}. Fatto? ${link}`;

  const color = kind === "preavviso" ? "#c2410c" : "#b91c1c";
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 12px;color:#475569;font-size:16px;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:8px 12px;font-size:18px;font-weight:600;color:#0f172a">${esc(value)}</td></tr>`;
  const emailHtml = `<!doctype html><html lang="it"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px">
  <div style="background:${color};color:#fff;padding:20px 24px;border-radius:16px 16px 0 0;font-size:22px;font-weight:700">${esc(subject)}</div>
  <div style="background:#fff;padding:24px;border-radius:0 0 16px 16px;border:1px solid #e2e8f0">
    ${name ? `<p style="font-size:18px;margin:0 0 16px">Ciao ${esc(name)},</p>` : ""}
    <p style="font-size:18px;margin:0 0 16px">${kind === "sollecito" ? "questa scadenza risulta ancora <b>da fare</b>." : kind === "oggi" ? "questa scadenza è <b>OGGI</b>." : "tra <b>3 giorni</b> c'è questa scadenza."}</p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px">
      ${row("Cosa", d.title)}
      ${row("Entro", formatLong(due) + (shifted ? ` (spostata dal ${formatShort(d.dueDate)}: ${shifted})` : ""))}
      ${amount ? row("Importo", amount) : ""}
      ${code ? row("Codice F24", code) : ""}
      ${d.portal ? row("Dove", d.portal) : ""}
    </table>
    ${d.description ? `<p style="font-size:16px;color:#334155;line-height:1.5">${esc(d.description)}</p>` : ""}
    ${d.specialRule ? `<p style="font-size:16px;background:#eff6ff;border-left:4px solid #2563eb;padding:12px;color:#1e3a8a">ℹ️ ${esc(d.specialRule)}</p>` : ""}
    ${d.notes ? `<p style="font-size:16px;color:#334155">📝 ${esc(d.notes)}</p>` : ""}
    <div style="text-align:center;margin:28px 0 8px">
      <a href="${esc(link)}" style="display:inline-block;background:#15803d;color:#fff;text-decoration:none;font-size:22px;font-weight:700;padding:18px 32px;border-radius:14px">✅ HO FATTO / CONFERMA</a>
    </div>
    <p style="font-size:13px;color:#64748b;text-align:center">Il pulsante apre una pagina dove confermare con un solo tocco, senza password.</p>
  </div>
  <p style="font-size:12px;color:#94a3b8;text-align:center">Scadenziario Anthony Greco – avviso automatico</p>
</div></body></html>`;

  return {
    deadlineId: d.id,
    kind,
    key: `${d.id}|${d.dueDate}|${kind}|${today}`,
    subject,
    emailHtml,
    emailText,
    whatsapp,
    sms,
    link,
    dueDate: due,
    daysLeft: n,
  };
}

export function collectAlerts(
  deadlines: Deadline[],
  today: string,
  settings: Settings,
  linkFor: (d: Deadline) => string,
): AlertMessage[] {
  const out: AlertMessage[] = [];
  for (const d of deadlines) {
    const kind = alertKindFor(d, today, settings.overdueReminder);
    if (kind) out.push(buildAlert(d, kind, today, settings, linkFor(d)));
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
