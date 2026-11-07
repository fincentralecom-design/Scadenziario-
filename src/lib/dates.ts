// Gestione date "pure" (YYYY-MM-DD) e calendario fiscale italiano.
// Tutti i calcoli usano UTC per evitare problemi di ora legale.

const TZ = "Europe/Rome";

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function makeDate(y: number, m: number, d: number): string {
  return toISODate(new Date(Date.UTC(y, m - 1, d)));
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISODate(d);
}

/**
 * Aggiunge n mesi mantenendo il giorno "àncora" (es. 31 → 30/28/29 → 31).
 * Se anchorDay non è indicato si usa il giorno della data di partenza.
 */
export function addMonths(s: string, n: number, anchorDay?: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const day = anchorDay ?? d;
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return makeDate(ny, nm, Math.min(day, daysInMonth(ny, nm)));
}

export function addYears(s: string, n: number): string {
  return addMonths(s, n * 12);
}

/** Differenza in giorni (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

/** Data odierna nel fuso orario italiano. */
export function todayRome(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function hourRome(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(now)) % 24;
}

/** Domenica di Pasqua (algoritmo gregoriano anonimo). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return makeDate(year, month, day);
}

const holidayCache = new Map<number, Map<string, string>>();

/** Festività nazionali italiane dell'anno (data → nome). */
export function italianHolidays(year: number): Map<string, string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const map = new Map<string, string>();
  const add = (m: number, d: number, name: string) => map.set(makeDate(year, m, d), name);
  add(1, 1, "Capodanno");
  add(1, 6, "Epifania");
  add(4, 25, "Festa della Liberazione");
  add(5, 1, "Festa del Lavoro");
  add(6, 2, "Festa della Repubblica");
  add(8, 15, "Ferragosto");
  // San Francesco d'Assisi: di nuovo festa nazionale dal 2026 (L. 151/2025).
  if (year >= 2026) add(10, 4, "San Francesco d'Assisi");
  add(11, 1, "Ognissanti");
  add(12, 8, "Immacolata Concezione");
  add(12, 25, "Natale");
  add(12, 26, "Santo Stefano");
  const easter = easterSunday(year);
  map.set(easter, "Pasqua");
  map.set(addDays(easter, 1), "Lunedì dell'Angelo");
  holidayCache.set(year, map);
  return map;
}

export function holidayName(s: string): string | undefined {
  return italianHolidays(parseDate(s).getUTCFullYear()).get(s);
}

export function isBusinessDay(s: string): boolean {
  const wd = parseDate(s).getUTCDay();
  if (wd === 0 || wd === 6) return false;
  return !holidayName(s);
}

/** Primo giorno lavorativo uguale o successivo alla data indicata. */
export function nextBusinessDay(s: string): string {
  let d = s;
  while (!isBusinessDay(d)) d = addDays(d, 1);
  return d;
}

/** Motivo dello spostamento (sabato, domenica o nome del festivo). */
export function nonBusinessReason(s: string): string | undefined {
  const h = holidayName(s);
  if (h) return h;
  const wd = parseDate(s).getUTCDay();
  if (wd === 6) return "sabato";
  if (wd === 0) return "domenica";
  return undefined;
}

const fmtLong = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtShort = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

/** "lunedì 16 novembre 2026" */
export function formatLong(s: string): string {
  return fmtLong.format(parseDate(s));
}

/** "16/11/2026" */
export function formatShort(s: string): string {
  return fmtShort.format(parseDate(s));
}

export const MONTHS_IT = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
