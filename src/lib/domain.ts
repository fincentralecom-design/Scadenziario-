// Regole di validazione pure (senza server): usate dalle API e dalla versione demo nel browser.
import { generateContractDeadlines, mergeContractDeadlines } from "./contracts";
import { newId } from "./deadlines";
import type { Contract, Deadline } from "./types";

const CLEARABLE = ["f24Code", "portal", "description", "notes", "specialRule", "calculator", "endDate"] as const;

export function sanitizeDeadline(raw: Partial<Deadline>, existing?: Deadline): Deadline {
  const now = new Date().toISOString();
  const input: Partial<Deadline> = { ...raw };
  const base: Partial<Deadline> = existing ? { ...existing } : {};
  // null = campo svuotato dall'utente: va rimosso.
  for (const k of CLEARABLE) {
    if ((input as Record<string, unknown>)[k] === null) {
      delete input[k];
      delete base[k];
    }
  }
  // Se l'utente scrive un codice tributo diverso, prevale su quello calcolato in automatico.
  if (existing?.f24Auto && "f24Code" in raw && raw.f24Code !== existing.f24Code) delete base.f24Auto;
  delete input.history;
  delete input.status;
  if (!input.title?.trim()) throw new Error("Il titolo è obbligatorio");
  if (!input.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new Error("Data non valida");
  const day = Number(input.dueDate.slice(8, 10));
  const dateChanged = !existing || existing.dueDate !== input.dueDate;
  return {
    createdAt: now,
    ...base,
    ...input,
    id: existing?.id ?? newId("s"),
    title: input.title.trim(),
    category: input.category ?? existing?.category ?? "altro",
    recurrence: input.recurrence ?? existing?.recurrence ?? "una_tantum",
    // Se l'utente cambia la data, il nuovo giorno diventa l'àncora (salvo fine mese).
    anchorDay: dateChanged ? (existing?.anchorDay === 31 && day >= 28 ? 31 : day) : existing?.anchorDay,
    amount: input.amount === undefined ? (existing?.amount ?? null) : input.amount,
    shiftIfHoliday: input.shiftIfHoliday ?? existing?.shiftIfHoliday ?? true,
    active: input.active ?? existing?.active ?? true,
    status: dateChanged && existing ? "todo" : (existing?.status ?? "todo"),
    history: existing?.history ?? [],
    updatedAt: now,
  } as Deadline;
}

/** Valida e normalizza i dati di un contratto. */
export function normalizeContract(input: Partial<Contract>, existing?: Contract | null): Contract {
  const now = new Date().toISOString();
  if (!input.tenant?.trim() || !input.property?.trim()) throw new Error("Inquilino e immobile sono obbligatori");
  if (!input.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error("Data di decorrenza non valida");
  return {
    id: existing?.id ?? newId("c"),
    tenant: input.tenant.trim(),
    property: input.property.trim(),
    startDate: input.startDate,
    annualRent: Math.max(0, Number(input.annualRent) || 0),
    cedolare: !!input.cedolare,
    initialYears: Math.max(1, Number(input.initialYears) || 4),
    renewalYears: Math.max(1, Number(input.renewalYears) || 4),
    facciate: Math.max(1, Number(input.facciate) || 4),
    copie: Math.max(1, Number(input.copie) || 1),
    alreadyRegistered: !!input.alreadyRegistered,
    notes: input.notes?.trim() || undefined,
    active: input.active ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

/** Calcola quali scadenze del contratto creare/aggiornare, eliminare o disattivare. */
export function planContractSync(contract: Contract, linked: Deadline[], today: string) {
  const generated = mergeContractDeadlines(generateContractDeadlines(contract, today), linked);
  const keep = new Set(generated.map((d) => d.id));
  // Scadenze non più previste (es. passaggio a cedolare secca): si rimuovono se mai completate.
  const stale = linked.filter((d) => !keep.has(d.id));
  return {
    generated,
    remove: stale.filter((d) => d.history.length === 0).map((d) => d.id),
    deactivate: stale.filter((d) => d.history.length > 0).map((d) => ({ ...d, active: false })),
  };
}
