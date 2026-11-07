// Operazioni lato server condivise da API, cron e pagina di conferma.
import "server-only";
import { collectAlerts, buildAlert, type AlertMessage } from "./alerts";
import { normalizeContract, planContractSync, sanitizeDeadline } from "./domain";
import { todayRome } from "./dates";
import { completeDeadline, effectiveDate, undoLastCompletion, type CompletionInput } from "./deadlines";
import { sendAlert, type SendResult } from "./notify";
import { pushPayloadFor, sendPushToAll } from "./push";
import { buildSeed } from "./seed";
import { getStore } from "./store";
import { magicLink } from "./token";
import { DEFAULT_SETTINGS, type Contract, type Deadline, type Settings } from "./types";

export { sanitizeDeadline };

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
  const contract = normalizeContract(input, existing);
  await store.upsertContract(contract);

  const all = await store.listDeadlines();
  const linked = all.filter((d) => d.contractId === contract.id);
  const { generated, remove, deactivate } = planContractSync(contract, linked, todayRome());
  await store.deleteDeadlines(remove);
  await store.upsertDeadlines(deactivate);
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

/** Email, WhatsApp, SMS e notifiche push sui dispositivi iscritti. */
export async function sendAllChannels(a: AlertMessage, settings: Settings): Promise<SendResult[]> {
  const results = await sendAlert(a, settings);
  if (settings.channels.push) {
    results.push(await sendPushToAll(pushPayloadFor(a)).catch((e: unknown) => ({ channel: "push" as const, ok: false, detail: String(e) })));
  }
  return results;
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
    const results = await sendAllChannels(a, settings);
    if (results.some((r) => r.ok)) sent.add(a.key);
    out.push({ ...a, results, alreadySent });
  }

  if (!opts.dryRun) {
    const sentNow = out.filter((a) => a.results.some((r) => r.ok));
    if (sentNow.length) {
      const { logAudit } = await import("./audit");
      for (const a of sentNow) {
        await logAudit({
          action: "avviso",
          actor: "Sistema",
          via: "sistema",
          target: a.subject.replace(/^[^:]+:\s*/, ""),
          targetId: a.deadlineId,
          summary: `${a.subject.split(":")[0]} inviato via ${a.results.filter((r) => r.ok).map((r) => r.channel).join(", ")}`,
        });
      }
    }
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
