// Logica di dominio sulle scadenze: data utile, stato semaforo, ricorrenze, completamento.
import { addMonths, diffDays, nextBusinessDay, nonBusinessReason, parseDate, MONTHS_IT } from "./dates";
import type { Calculator, Deadline, HistoryEntry, Recurrence } from "./types";

export const RECURRENCE_MONTHS: Record<Recurrence, number> = {
  una_tantum: 0,
  mensile: 1,
  trimestrale: 3,
  semestrale: 6,
  annuale: 12,
};

/** Data utile effettiva: sposta al primo giorno lavorativo se previsto. */
export function effectiveDate(d: Pick<Deadline, "dueDate" | "shiftIfHoliday">): string {
  return d.shiftIfHoliday ? nextBusinessDay(d.dueDate) : d.dueDate;
}

/** Spiegazione dello spostamento, es. "Il 16/05 cade di sabato". */
export function shiftReason(d: Pick<Deadline, "dueDate" | "shiftIfHoliday">): string | undefined {
  if (!d.shiftIfHoliday) return undefined;
  if (effectiveDate(d) === d.dueDate) return undefined;
  return nonBusinessReason(d.dueDate);
}

export function daysLeft(d: Pick<Deadline, "dueDate" | "shiftIfHoliday">, today: string): number {
  return diffDays(today, effectiveDate(d));
}

export type Bucket = "red" | "orange" | "yellow" | "later" | "done" | "inactive";

/** Semaforo: rosso = oggi/scadute, arancione = 1-3 giorni, giallo = entro 30 giorni. */
export function bucketOf(d: Deadline, today: string): Bucket {
  if (!d.active) return "inactive";
  if (d.status === "done") return "done";
  const n = daysLeft(d, today);
  if (n <= 0) return "red";
  if (n <= 3) return "orange";
  if (n <= 30) return "yellow";
  return "later";
}

export function nextNominalDate(d: Pick<Deadline, "dueDate" | "recurrence" | "anchorDay">): string | null {
  const months = RECURRENCE_MONTHS[d.recurrence];
  if (!months) return null;
  return addMonths(d.dueDate, months, d.anchorDay);
}

/** Codice tributo: fisso oppure calcolato (IVA mensile 6001-6012 sul mese di competenza). */
export function f24CodeFor(d: Pick<Deadline, "f24Code" | "f24Auto" | "dueDate">): string | undefined {
  if (d.f24Auto === "iva_mensile") {
    const m = parseDate(d.dueDate).getUTCMonth(); // 0 = gennaio
    const competence = m === 0 ? 12 : m; // mese precedente (1-12)
    return `${6000 + competence} (IVA ${MONTHS_IT[competence - 1]})`;
  }
  return d.f24Code || undefined;
}

export function calculate(calc: Calculator, base: number): number {
  const raw = calc.type === "percent" ? (base * calc.rate) / 100 : base * calc.unitAmount;
  const value = calc.min && raw > 0 ? Math.max(raw, calc.min) : raw;
  return Math.round(value * 100) / 100;
}

export function formatEuro(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

export function newId(prefix = "s"): string {
  const rnd = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${rnd.replace(/-/g, "").slice(0, 16)}`;
}

export interface CompletionInput {
  note?: string;
  amountPaid?: number | null;
  receiptName?: string;
  receiptData?: string;
  completedAt?: string;
  via?: "app" | "magic-link";
}

/**
 * Segna la scadenza come fatta: salva nello storico e, se ricorrente,
 * rigenera la scadenza per il periodo successivo.
 */
export function completeDeadline(d: Deadline, input: CompletionInput = {}): Deadline {
  const now = new Date().toISOString();
  const entry: HistoryEntry = {
    id: newId("h"),
    dueDate: effectiveDate(d),
    nominalDueDate: d.dueDate,
    completedAt: input.completedAt || now,
    note: input.note?.trim() || undefined,
    amountPaid: input.amountPaid ?? null,
    receiptName: input.receiptName,
    receiptData: input.receiptData,
    via: input.via ?? "app",
  };
  const next = nextNominalDate(d);
  const updated: Deadline = { ...d, history: [entry, ...d.history], updatedAt: now };
  if (next && (!d.endDate || next <= d.endDate)) {
    updated.dueDate = next;
    updated.status = "todo";
  } else {
    updated.status = "done";
  }
  return updated;
}

/** Annulla l'ultimo completamento (in caso di clic per errore). */
export function undoLastCompletion(d: Deadline): Deadline {
  const [last, ...rest] = d.history;
  if (!last) return d;
  return { ...d, dueDate: last.nominalDueDate, status: "todo", history: rest, updatedAt: new Date().toISOString() };
}

/** Prima occorrenza (secondo la ricorrenza) con data utile >= oggi. */
export function rollForward(d: Deadline, today: string): Deadline {
  let cur = { ...d };
  let guard = 0;
  while (effectiveDate(cur) < today && guard++ < 500) {
    const next = nextNominalDate(cur);
    if (!next) break;
    cur = { ...cur, dueDate: next };
  }
  return cur;
}

export function sortByDate(list: Deadline[]): Deadline[] {
  return [...list].sort((a, b) => effectiveDate(a).localeCompare(effectiveDate(b)) || a.title.localeCompare(b.title));
}

