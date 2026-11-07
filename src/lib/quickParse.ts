// Interprete "di base" (senza AI) di frasi italiane per creare scadenze.
// Usato quando la chiave AI non è configurata e nella versione di prova.
import { addDays, addMonths, makeDate, parseDate, MONTHS_IT } from "./dates";
import type { Category, Recurrence } from "./types";

export interface DeadlineDraft {
  title: string;
  category: Category;
  dueDate: string;
  recurrence: Recurrence;
  amount: number | null;
  f24Code: string | null;
  portal: string | null;
  notes: string | null;
  shiftIfHoliday: boolean;
}

const WORD_NUM: Record<string, number> = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, quindici: 15, venti: 20, trenta: 30 };

function num(s: string): number {
  return WORD_NUM[s.toLowerCase()] ?? Number(s);
}

function guessCategory(t: string, rec: Recurrence): Category {
  if (/affitt|locazion|inquilin|rli|registro|canone/i.test(t)) return "locazione";
  if (/estintor|caldai|manutenz|revision|gas|fumi|assicuraz|alloggiati/i.test(t)) return "sicurezza";
  if (rec === "mensile") return "mensile";
  if (rec === "trimestrale") return "trimestrale";
  if (rec === "annuale") return "annuale";
  return "altro";
}

/** Prima data con quel giorno/mese uguale o successiva a oggi. */
function nextDayMonth(today: string, day: number, month: number | null): string {
  const t = parseDate(today);
  const y = t.getUTCFullYear();
  if (month) {
    let d = makeDate(y, month, Math.min(day, new Date(Date.UTC(y, month, 0)).getUTCDate()));
    if (d < today) d = makeDate(y + 1, month, Math.min(day, new Date(Date.UTC(y + 1, month, 0)).getUTCDate()));
    return d;
  }
  const m = t.getUTCMonth() + 1;
  let d = makeDate(y, m, Math.min(day, new Date(Date.UTC(y, m, 0)).getUTCDate()));
  if (d < today) d = addMonths(d, 1, day);
  return d;
}

/** Spezza un messaggio in più scadenze ("... e poi ...", righe, punti e virgola). */
function splitRequests(text: string): string[] {
  return text
    .split(/\n|;|\.\s+(?=[A-ZÀ-Ú])|\s+e poi\s+|\s+inoltre\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

export function quickParse(text: string, today: string): { reply: string; deadlines: DeadlineDraft[] } {
  const drafts: DeadlineDraft[] = [];
  const missing: string[] = [];

  for (const part of splitRequests(text)) {
    let t = ` ${part} `;
    const low = t.toLowerCase();
    let recurrence: Recurrence = "una_tantum";
    if (/ogni mese|mensil|al mese|tutti i mesi/.test(low)) recurrence = "mensile";
    else if (/ogni (tre|3) mesi|trimestral|ogni trimestre/.test(low)) recurrence = "trimestrale";
    else if (/ogni (sei|6) mesi|semestral/.test(low)) recurrence = "semestrale";
    else if (/ogni anno|annual|all'anno|tutti gli anni/.test(low)) recurrence = "annuale";

    let dueDate: string | null = null;
    const months = MONTHS_IT.join("|");
    let m: RegExpMatchArray | null;
    if ((m = low.match(/(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/))) {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      if (m[3]) {
        const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
        dueDate = makeDate(y, mo, d);
      } else dueDate = nextDayMonth(today, d, mo);
      t = t.replace(m[0], " ");
    } else if ((m = low.match(new RegExp(`(\\d{1,2}|primo)\\s*(?:di\\s+)?(${months})(?:\\s+(\\d{4}))?`)))) {
      const d = m[1] === "primo" ? 1 : Number(m[1]);
      const mo = MONTHS_IT.indexOf(m[2]) + 1;
      dueDate = m[3] ? makeDate(Number(m[3]), mo, d) : nextDayMonth(today, d, mo);
      t = t.replace(new RegExp(m[0], "i"), " ");
    } else if ((m = low.match(/(?:il\s+(?:giorno\s+)?)?(\d{1,2})\s+(?:di\s+)?(?:ogni|del)\s+mese/))) {
      dueDate = nextDayMonth(today, Number(m[1]), null);
      recurrence = "mensile";
      t = t.replace(new RegExp(m[0], "i"), " ");
    } else if ((m = low.match(/tra\s+(\w+)\s+(giorn|settiman|mes)/))) {
      const n = num(m[1]);
      if (!Number.isNaN(n)) dueDate = m[2] === "giorn" ? addDays(today, n) : m[2] === "settiman" ? addDays(today, n * 7) : addMonths(today, n);
      t = t.replace(new RegExp(`tra\\s+${m[1]}\\s+\\w+`, "i"), " ");
    } else if (/\bdopodomani\b/.test(low)) {
      dueDate = addDays(today, 2);
      t = t.replace(/dopodomani/i, " ");
    } else if (/\bdomani\b/.test(low)) {
      dueDate = addDays(today, 1);
      t = t.replace(/domani/i, " ");
    } else if (/\boggi\b/.test(low)) {
      dueDate = today;
      t = t.replace(/oggi/i, " ");
    }

    let amount: number | null = null;
    if ((m = t.match(/(?:€\s*)(\d[\d.]*(?:,\d{1,2})?)|(\d[\d.]*(?:,\d{1,2})?)\s*(?:€|euro)/i))) {
      amount = Number((m[1] || m[2]).replace(/\./g, "").replace(",", "."));
      t = t.replace(m[0], " ");
    }

    let f24Code: string | null = null;
    if ((m = t.match(/(?:codice(?:\s+tributo)?|cod\.?|f24)\s*:?\s*(\d{4})/i))) {
      f24Code = m[1];
      t = t.replace(m[0], " ");
    }

    let title = t
      .replace(/\b(ricordami|ricorda(?:mi)? di|aggiungi(?: una)? scadenza(?: per)?|inserisci|devo|dovrò|segna|crea|pagare il|pagare la|pagare)\b/gi, " ")
      .replace(/\b(ogni mese|ogni anno|ogni tre mesi|ogni sei mesi|mensile|annuale|trimestrale|semestrale|tutti i mesi|tutti gli anni|entro il|entro|scade il|scade|il giorno|alle ore \d+)\b/gi, " ")
      .replace(/\s+(di|il|la|lo|del|della|per|a|e|da)\s*$/i, " ")
      .replace(/^\s*(di|il|la|lo|per|a)\s+/i, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .replace(/[,.:;]+$/, "");
    if (title) title = title.charAt(0).toUpperCase() + title.slice(1);

    if (!title || !dueDate) {
      missing.push(part);
      continue;
    }
    drafts.push({
      title,
      category: guessCategory(part, recurrence),
      dueDate,
      recurrence,
      amount,
      f24Code,
      portal: null,
      notes: null,
      shiftIfHoliday: f24Code !== null || /f24|iva|imu|tari|tass|impost|bollo|inps/i.test(part),
    });
  }

  let reply: string;
  if (drafts.length) {
    reply = `Ho preparato ${drafts.length === 1 ? "questa scadenza" : `queste ${drafts.length} scadenze`}. Controlla e premi “Salva”.`;
    if (missing.length) reply += ` Non ho capito la data di: “${missing.join("”, “")}”.`;
  } else {
    reply = "Non ho capito la data. Prova così: “Assicurazione struttura il 20 dicembre, 350 euro, ogni anno”.";
  }
  return { reply, deadlines: drafts };
}
