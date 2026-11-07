// "Server" simulato nel browser per la versione locale (index.html):
// stesse regole dell'app vera, dati salvati nel localStorage del browser.
import { buildAlert, collectAlerts } from "@/lib/alerts";
import { todayRome } from "@/lib/dates";
import { completeDeadline, effectiveDate, undoLastCompletion, type CompletionInput } from "@/lib/deadlines";
import { normalizeContract, planContractSync, sanitizeDeadline } from "@/lib/domain";
import { buildSeed } from "@/lib/seed";
import { DEFAULT_SETTINGS, type Contract, type Deadline, type Settings } from "@/lib/types";

const KEY = "scadenziario-pro-demo-v1";

interface DemoDB {
  deadlines: Record<string, Deadline>;
  contracts: Record<string, Contract>;
  settings: Settings;
}

let memory: DemoDB | null = null;

export function load(): DemoDB {
  if (memory) return memory;
  let db: DemoDB | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) db = JSON.parse(raw) as DemoDB;
  } catch {
    /* localStorage non disponibile: si lavora in memoria */
  }
  if (!db) {
    db = { deadlines: {}, contracts: {}, settings: { ...DEFAULT_SETTINGS } };
    buildSeed(todayRome()).forEach((d) => (db!.deadlines[d.id] = d));
  }
  memory = db;
  save();
  return db;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* spazio esaurito o accesso negato: i dati restano solo in memoria */
  }
}

export function resetDemo() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
  memory = null;
}

export function linkFor(d: Deadline): string {
  return `${location.href.split("#")[0]}#conferma/${encodeURIComponent(d.id)}/${d.dueDate}`;
}

function alertsFor(date: string) {
  const db = load();
  const msgs = collectAlerts(Object.values(db.deadlines), date, db.settings, linkFor).map((m) => ({ ...m, alreadySent: false }));
  if (msgs.length) return { date, isSample: false, messages: msgs };
  const next = Object.values(db.deadlines)
    .filter((d) => d.active && d.status === "todo" && effectiveDate(d) >= todayRome())
    .sort((a, b) => effectiveDate(a).localeCompare(effectiveDate(b)))[0];
  const sample = next ? [{ ...buildAlert(next, "preavviso", todayRome(), db.settings, linkFor(next)), alreadySent: false }] : [];
  return { date, isSample: true, messages: sample };
}

export function completeLocal(id: string, input: CompletionInput): Deadline | null {
  const db = load();
  const d = db.deadlines[id];
  if (!d) return null;
  db.deadlines[id] = completeDeadline(d, input);
  save();
  return db.deadlines[id];
}

export function undoLocal(id: string): Deadline | null {
  const db = load();
  const d = db.deadlines[id];
  if (!d) return null;
  db.deadlines[id] = undoLastCompletion(d);
  save();
  return db.deadlines[id];
}

async function handle(url: string, method: string, body?: unknown): Promise<unknown> {
  const db = load();
  const parts = url.split("?")[0].split("/").filter(Boolean).slice(1); // senza "api"
  const [res, id, action] = parts.map(decodeURIComponent);

  if (res === "deadlines") {
    if (!id && method === "GET") {
      const deadlines = Object.values(db.deadlines).map((d) => ({
        ...d,
        history: d.history.map(({ receiptData, ...h }) => ({ ...h, hasReceipt: !!receiptData })),
      }));
      return { today: todayRome(), deadlines, contracts: Object.values(db.contracts), storage: { kind: "browser", persistent: true } };
    }
    if (!id && method === "POST") {
      const d = sanitizeDeadline({ ...(body as Partial<Deadline>), id: undefined });
      db.deadlines[d.id] = d;
      save();
      return d;
    }
    const existing = db.deadlines[id];
    if (!existing) throw new Error("Scadenza non trovata");
    if (action === "complete") return completeLocal(id, { ...(body as CompletionInput), via: "app" });
    if (action === "undo") return undoLocal(id);
    if (method === "PUT") {
      const d = sanitizeDeadline(body as Partial<Deadline>, existing);
      db.deadlines[id] = d;
      save();
      return d;
    }
    if (method === "DELETE") {
      delete db.deadlines[id];
      save();
      return { ok: true };
    }
  }

  if (res === "contracts") {
    if (method === "DELETE") {
      Object.values(db.deadlines).filter((d) => d.contractId === id).forEach((d) => delete db.deadlines[d.id]);
      delete db.contracts[id];
      save();
      return { ok: true };
    }
    if (method === "POST" || method === "PUT") {
      const existing = id ? db.contracts[id] : null;
      const contract = normalizeContract({ ...(body as Partial<Contract>), id }, existing);
      db.contracts[contract.id] = contract;
      const linked = Object.values(db.deadlines).filter((d) => d.contractId === contract.id);
      const plan = planContractSync(contract, linked, todayRome());
      plan.remove.forEach((x) => delete db.deadlines[x]);
      [...plan.deactivate, ...plan.generated].forEach((d) => (db.deadlines[d.id] = d));
      save();
      return { contract, deadlines: plan.generated };
    }
    return Object.values(db.contracts);
  }

  if (res === "settings") {
    if (method === "PUT") {
      const b = body as Settings;
      if (b.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)) throw new Error("Email non valida");
      db.settings = { ...db.settings, ...b };
      save();
      return db.settings;
    }
    return {
      settings: db.settings,
      providers: { email: null, sms: null, whatsapp: null },
      effectiveUrl: location.href.split("#")[0],
      cronProtected: true,
      magicSecretSet: true,
      runs: [],
    };
  }

  if (res === "alerts") {
    const b = (body ?? {}) as { action?: string; date?: string };
    const out = alertsFor(b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : todayRome());
    if (b.action !== "send") return out;
    const note = "Versione locale di prova: nessun invio reale. Pubblica l'app online e configura i servizi di invio.";
    return {
      ...out,
      sent: out.messages.map((m) => ({
        subject: `[TEST] ${m.subject}`,
        results: (["email", "whatsapp", "sms"] as const)
          .filter((c) => db.settings.channels[c])
          .map((channel) => ({ channel, ok: false, skipped: true, detail: note })),
      })),
    };
  }

  throw new Error(`Operazione non disponibile nella versione locale: ${method} ${url}`);
}

function receipt(deadlineId: string, historyId: string): string {
  const h = load().deadlines[deadlineId]?.history.find((x) => x.id === historyId);
  if (!h?.receiptData) return "#";
  const [meta, b64] = h.receiptData.split(",");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: meta.slice(5).split(";")[0] }));
}

export function installMockApi() {
  (globalThis as Record<string, unknown>).__scadenziarioDemo = {
    api: async (url: string, method: string, body?: unknown) => {
      // copia profonda: l'interfaccia non deve modificare i dati salvati per riferimento
      const r = await handle(url, method, body);
      return r === undefined ? r : JSON.parse(JSON.stringify(r));
    },
    receipt,
  };
}
