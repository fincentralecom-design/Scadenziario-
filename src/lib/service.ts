// Operazioni lato server condivise da API, cron e pagina di conferma.
import "server-only";
import { collectAlerts, buildAlert, type AlertMessage } from "./alerts";
import { mergeContractDeadlines, generateContractDeadlines } from "./contracts";
import { todayRome } from "./dates";
import { completeDeadline, effectiveDate, newId, undoLastCompletion, type CompletionInput } from "./deadlines";
import { sendAlert, type SendResult } from "./notify";
import { buildSeed } from "./seed";
import { getStore } from "./store";
import { magicLink } from "./token";
import { DEFAULT_SETTINGS, type Contract, type Deadline, type Settings } from "./types";

const SEEDED_KEY = "seeded_v1";
const SETTINGS_KEY = "settings";
const SENT_KEY = "sent_alerts";
const RUNS_KEY = "cron_runs";

export async function ensureSeeded(): Promise<void> {
  const store = getStore();
  if (await store.getKV<boolean>(SEEDED_KEY)) return;
  const existing = new Set((await store.listDeadlines()).map((d) => d.id));
  await store.upsertDeadlines(buildSeed(todayRome()).filter((d) => !existing.has(d.id)));
  await store.setKV(SEEDED_KEY, true);
}

export async function listDeadlines(): Promise<Deadline[]> {
  await ensureSeeded();
  return getStore().listDeadlines();
}

export async function getSettings(): Promise<Settings> {
  const s = await getStore().getKV<Partial<Settings>>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...s, channels: { ...DEFAULT_SETTINGS.channels, ...s?.channels } };
}

export async function saveSettings(s: Partial<Settings>): Promise<Settings> {
  const merged = { ...(await getSettings()), ...s };
  await getStore().setKV(SETTINGS_KEY, merged);
  return merged;
}

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

export async function completeById(id: string, input: CompletionInput): Promise<Deadline | null> {
  const store = getStore();
  const d = await store.getDeadline(id);
  if (!d) return null;
  const updated = completeDeadline(d, input);
  await store.upsertDeadlines([updated]);
  return updated;
}

export async function undoById(id: string): Promise<Deadline | null> {
  const store = getStore();
  const d = await store.getDeadline(id);
  if (!d) return null;
  const updated = undoLastCompletion(d);
  await store.upsertDeadlines([updated]);
  return updated;
}

// ---------------- Contratti ----------------

export async function saveContract(input: Partial<Contract>): Promise<{ contract: Contract; deadlines: Deadline[] }> {
  const store = getStore();
  const now = new Date().toISOString();
  const existing = input.id ? await store.getContract(input.id) : null;
  if (!input.tenant?.trim() || !input.property?.trim()) throw new Error("Inquilino e immobile sono obbligatori");
  if (!input.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error("Data di decorrenza non valida");
  const contract: Contract = {
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
  await store.upsertContract(contract);

  const all = await store.listDeadlines();
  const linked = all.filter((d) => d.contractId === contract.id);
  const generated = mergeContractDeadlines(generateContractDeadlines(contract, todayRome()), linked);
  const keep = new Set(generated.map((d) => d.id));
  // Scadenze non più previste (es. passaggio a cedolare secca): si rimuovono se mai completate.
  const stale = linked.filter((d) => !keep.has(d.id));
  await store.deleteDeadlines(stale.filter((d) => d.history.length === 0).map((d) => d.id));
  await store.upsertDeadlines(stale.filter((d) => d.history.length > 0).map((d) => ({ ...d, active: false })));
  await store.upsertDeadlines(generated);
  return { contract, deadlines: generated };
}

export async function deleteContract(id: string): Promise<void> {
  const store = getStore();
  const linked = (await store.listDeadlines()).filter((d) => d.contractId === id).map((d) => d.id);
  await store.deleteDeadlines(linked);
  await store.deleteContract(id);
}

// ---------------- Avvisi ----------------

export function linkForDeadline(d: Deadline, s: Settings): string {
  return magicLink(d.id, d.dueDate, s.appUrl);
}

export interface DailyRunResult {
  today: string;
  dryRun: boolean;
  alerts: (AlertMessage & { results: SendResult[]; alreadySent: boolean })[];
}

/**
 * Controllo giornaliero: trova le scadenze a -3 giorni / oggi (/ scadute)
 * e invia gli avvisi una sola volta al giorno per ciascuna.
 */
export async function runDailyCheck(opts: { today?: string; dryRun?: boolean } = {}): Promise<DailyRunResult> {
  const store = getStore();
  const today = opts.today || todayRome();
  const settings = await getSettings();
  const deadlines = await listDeadlines();
  const alerts = collectAlerts(deadlines, today, settings, (d) => linkForDeadline(d, settings));
  const sent = new Set((await store.getKV<string[]>(SENT_KEY)) ?? []);
  const out: DailyRunResult["alerts"] = [];

  for (const a of alerts) {
    const alreadySent = sent.has(a.key);
    if (opts.dryRun || alreadySent) {
      out.push({ ...a, results: [], alreadySent });
      continue;
    }
    const results = await sendAlert(a, settings);
    if (results.some((r) => r.ok)) sent.add(a.key);
    out.push({ ...a, results, alreadySent });
  }

  if (!opts.dryRun) {
    await store.setKV(SENT_KEY, [...sent].slice(-2000));
    const runs = (await store.getKV<unknown[]>(RUNS_KEY)) ?? [];
    runs.unshift({ at: new Date().toISOString(), today, alerts: out.length, sent: out.filter((a) => a.results.some((r) => r.ok)).length });
    await store.setKV(RUNS_KEY, runs.slice(0, 30));
  }
  return { today, dryRun: !!opts.dryRun, alerts: out };
}

export async function lastRuns(): Promise<unknown[]> {
  return (await getStore().getKV<unknown[]>(RUNS_KEY)) ?? [];
}

/** Messaggio di esempio (per l'anteprima quando oggi non scatta nessun avviso). */
export async function sampleAlert(): Promise<AlertMessage | null> {
  const settings = await getSettings();
  const today = todayRome();
  const next = (await listDeadlines())
    .filter((d) => d.active && d.status === "todo" && effectiveDate(d) >= today)
    .sort((a, b) => effectiveDate(a).localeCompare(effectiveDate(b)))[0];
  if (!next) return null;
  return buildAlert(next, "preavviso", today, settings, linkForDeadline(next, settings));
}
