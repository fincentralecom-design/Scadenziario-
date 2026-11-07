// Diario attività: registra chi ha fatto cosa e quando (creazioni, modifiche, completamenti...).
import "server-only";
import { formatShort } from "./dates";
import { formatEuro } from "./deadlines";
import { getStore } from "./store";
import { CATEGORY_LABELS, RECURRENCE_LABELS, type Deadline } from "./types";

const KEY = "audit_log";
const MAX = 3000;

export type AuditAction =
  | "creata"
  | "modificata"
  | "eliminata"
  | "completata"
  | "annullata"
  | "disattivata"
  | "riattivata"
  | "contratto"
  | "impostazioni"
  | "password"
  | "accesso"
  | "avviso"
  | "backup";

export interface AuditChange {
  field: string;
  from: string;
  to: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  action: AuditAction;
  /** Chi: nome scelto sul dispositivo, "Link di conferma" o "Sistema". */
  actor: string;
  via: "app" | "link" | "sistema";
  device?: string;
  target: string;
  targetId?: string;
  summary: string;
  changes?: AuditChange[];
}

/** Ricava chi sta agendo dalla richiesta (nome del dispositivo scelto nelle Impostazioni + tipo di telefono). */
export function actorFrom(req: Request): { actor: string; device: string } {
  let name = "";
  try {
    name = decodeURIComponent(req.headers.get("x-device-name") || "").trim().slice(0, 40);
  } catch {
    /* ignora */
  }
  const ua = req.headers.get("user-agent") || "";
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "PC Windows"
            : "Browser";
  return { actor: name || `Utente (${device})`, device };
}

export async function logAudit(e: Omit<AuditEntry, "id" | "at">): Promise<void> {
  try {
    const store = getStore();
    const list = (await store.getKV<AuditEntry[]>(KEY)) ?? [];
    list.unshift({ ...e, id: `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString() });
    await store.setKV(KEY, list.slice(0, MAX));
  } catch (err) {
    console.error("Diario non salvato:", err);
  }
}

export async function listAudit(): Promise<AuditEntry[]> {
  return (await getStore().getKV<AuditEntry[]>(KEY)) ?? [];
}

export async function replaceAudit(list: AuditEntry[]): Promise<void> {
  await getStore().setKV(KEY, list.slice(0, MAX));
}

const FIELDS: [keyof Deadline, string, (v: unknown) => string][] = [
  ["title", "Titolo", (v) => String(v ?? "")],
  ["dueDate", "Data", (v) => (v ? formatShort(String(v)) : "")],
  ["recurrence", "Ricorrenza", (v) => RECURRENCE_LABELS[v as keyof typeof RECURRENCE_LABELS] ?? ""],
  ["category", "Categoria", (v) => CATEGORY_LABELS[v as keyof typeof CATEGORY_LABELS] ?? ""],
  ["amount", "Importo", (v) => (typeof v === "number" && v ? formatEuro(v) : "—")],
  ["f24Code", "Codice F24", (v) => String(v ?? "—")],
  ["portal", "Dove", (v) => String(v ?? "—")],
  ["description", "Descrizione", (v) => String(v ?? "—")],
  ["notes", "Note", (v) => String(v ?? "—")],
  ["specialRule", "Regola speciale", (v) => String(v ?? "—")],
  ["shiftIfHoliday", "Sposta se festivo", (v) => (v ? "Sì" : "No")],
  ["active", "Attiva", (v) => (v ? "Sì" : "No")],
];

export function diffDeadline(before: Deadline, after: Deadline): AuditChange[] {
  const out: AuditChange[] = [];
  for (const [k, label, fmt] of FIELDS) {
    const a = fmt(before[k]);
    const b = fmt(after[k]);
    if (a !== b) out.push({ field: label, from: a, to: b });
  }
  if (JSON.stringify(before.calculator ?? null) !== JSON.stringify(after.calculator ?? null)) {
    out.push({ field: "Calcolatore", from: before.calculator ? "presente" : "—", to: after.calculator ? "presente" : "—" });
  }
  return out;
}
