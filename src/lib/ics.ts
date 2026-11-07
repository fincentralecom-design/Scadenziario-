// Esportazione delle scadenze nel Calendario (iPhone, Google, Outlook) con promemoria.
import { addDays } from "./dates";
import { effectiveDate, f24CodeFor, formatEuro, nextNominalDate } from "./deadlines";
import type { Deadline } from "./types";

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Spezza le righe lunghe come richiesto dal formato iCalendar (75 caratteri). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

const ymd = (s: string) => s.replace(/-/g, "");

/** Occorrenze delle scadenze attive dai prossimi `months` mesi, ognuna con avviso a -3 giorni e il giorno stesso alle 8:30. */
export function buildIcs(deadlines: Deadline[], today: string, months = 12, appUrl = "", onlyFirst = false): string {
  const until = addDays(today, Math.round(months * 30.5));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Scadenziario Greco//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Scadenziario Greco",
    "X-WR-TIMEZONE:Europe/Rome",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const d of deadlines) {
    if (!d.active || d.status !== "todo") continue;
    let cur: Deadline | null = d;
    let guard = 0;
    while (cur && effectiveDate(cur) <= until && guard++ < 60) {
      const due = effectiveDate(cur);
      const code = f24CodeFor(cur);
      const desc = [
        cur.description,
        cur.amount ? `Importo: ${formatEuro(cur.amount)}` : "",
        code ? `Codice F24: ${code}` : "",
        cur.portal ? `Dove: ${cur.portal}` : "",
        cur.specialRule ?? "",
        appUrl ? `Apri lo scadenziario: ${appUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${cur.id}-${cur.dueDate}@scadenziario-greco`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd(due)}`,
        `DTEND;VALUE=DATE:${ymd(addDays(due, 1))}`,
        fold(`SUMMARY:${esc(`📌 ${cur.title}`)}`),
        fold(`DESCRIPTION:${esc(desc)}`),
        "TRANSP:TRANSPARENT",
        // Promemoria: 3 giorni prima alle 8:30 e il giorno stesso alle 8:30
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        fold(`DESCRIPTION:${esc(`⏳ Tra 3 giorni: ${cur.title}`)}`),
        "TRIGGER:-P2DT15H30M",
        "END:VALARM",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        fold(`DESCRIPTION:${esc(`🚨 Scade oggi: ${cur.title}`)}`),
        "TRIGGER:PT8H30M",
        "END:VALARM",
        "END:VEVENT",
      );
      if (onlyFirst) break;
      const next = nextNominalDate(cur);
      cur = next && (!cur.endDate || next <= cur.endDate) ? { ...cur, dueDate: next } : null;
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
