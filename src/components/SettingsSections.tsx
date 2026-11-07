"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, Eye, EyeOff, FileSpreadsheet, KeyRound, RefreshCw, Save, ShieldCheck, Upload, UserRound } from "lucide-react";
import type { Settings } from "@/lib/types";
import { api, deviceName, isDemo, setDeviceName } from "./api";
import type { Notify } from "./feedback";

const card = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200";

/* ------------------------------------------------------------------ */
/* Account e password                                                  */
/* ------------------------------------------------------------------ */

export function AccountSection({
  notify,
  settings,
  setSettings,
  onSaved,
}: {
  notify: Notify;
  settings: Settings;
  setSettings: (s: Settings) => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setName(deviceName()), []);

  const saveName = () => {
    setDeviceName(name);
    notify(name.trim() ? `👤 Questo dispositivo ora è “${name.trim()}”` : "Nome del dispositivo rimosso");
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== again) return notify("Le due nuove password non coincidono.");
    if (next.length < 8) return notify("La nuova password deve avere almeno 8 caratteri.");
    setBusy(true);
    try {
      await api("/api/password/change", "POST", { current: cur, next });
      setCur("");
      setNext("");
      setAgain("");
      notify("🔑 Password cambiata. Usala dal prossimo accesso.");
    } catch (err) {
      notify(`${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  const saveRecovery = async () => {
    setBusy(true);
    try {
      await api("/api/settings", "PUT", settings);
      await onSaved();
      notify("💾 Email di recupero salvata");
    } catch (err) {
      notify(`Errore: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className={card}>
        <h3 className="mb-1 flex items-center gap-2 text-2xl font-extrabold">
          <UserRound className="h-7 w-7" aria-hidden /> Chi usa questo telefono?
        </h3>
        <p className="mb-3 text-base text-slate-600">
          Scrivi un nome (es. <b>Anthony</b> o <b>Bruno</b>). Nel <b>Diario attività</b> vedrai chi ha fatto ogni modifica. Va impostato su ogni telefono o computer.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="field flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Anthony" aria-label="Nome di chi usa questo dispositivo" />
          <button className="btn-green" onClick={saveName}>
            <Save className="h-5 w-5" aria-hidden /> Salva nome
          </button>
        </div>
      </section>

      <form onSubmit={changePassword} className={card}>
        <h3 className="mb-1 flex items-center gap-2 text-2xl font-extrabold">
          <KeyRound className="h-7 w-7" aria-hidden /> Cambia password
        </h3>
        <p className="mb-3 text-base text-slate-600">Almeno 8 caratteri. Il nome utente resta lo stesso.</p>
        {isDemo() ? (
          <p className="rounded-xl bg-amber-50 p-4 text-lg text-amber-900">Disponibile solo nell&apos;app pubblicata online.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="pw-cur">Password attuale</label>
              <input id="pw-cur" type={show ? "text" : "password"} autoComplete="current-password" className="field" value={cur} onChange={(e) => setCur(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="pw-new">Nuova password</label>
              <input id="pw-new" type={show ? "text" : "password"} autoComplete="new-password" className="field" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
            </div>
            <div>
              <label className="label" htmlFor="pw-again">Ripeti la nuova password</label>
              <input id="pw-again" type={show ? "text" : "password"} autoComplete="new-password" className="field" value={again} onChange={(e) => setAgain(e.target.value)} required minLength={8} />
            </div>
            <button type="button" className="flex items-center gap-2 text-base font-semibold text-blue-700" onClick={() => setShow(!show)}>
              {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />} {show ? "Nascondi" : "Mostra"} password
            </button>
            <button type="submit" className="btn-green w-full py-4 text-xl" disabled={busy}>
              <KeyRound className="h-6 w-6" aria-hidden /> Cambia password
            </button>
          </div>
        )}
      </form>

      <section className={card}>
        <h3 className="mb-1 flex items-center gap-2 text-2xl font-extrabold">
          <ShieldCheck className="h-7 w-7" aria-hidden /> Password dimenticata
        </h3>
        <p className="mb-3 text-base text-slate-600">
          Se dimentichi la password, nella pagina di accesso tocca <b>“Password dimenticata?”</b>: arriva un link a questa email per sceglierne una nuova (vale 1 ora).
          Se lasci vuoto si usa l&apos;email degli avvisi.
        </p>
        <label className="label" htmlFor="rec-email">Email di recupero</label>
        <input
          id="rec-email"
          type="email"
          className="field"
          value={settings.recoveryEmail}
          onChange={(e) => setSettings({ ...settings, recoveryEmail: e.target.value })}
          placeholder={settings.email || "nome@esempio.it"}
        />
        <button className="btn-green mt-3 w-full" onClick={() => void saveRecovery()} disabled={busy}>
          <Save className="h-5 w-5" aria-hidden /> Salva email di recupero
        </button>
        <p className="mt-2 text-sm text-slate-500">Serve il servizio email (Resend) attivo sul sito.</p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Diario attività                                                     */
/* ------------------------------------------------------------------ */

interface AuditEntry {
  id: string;
  at: string;
  action: string;
  actor: string;
  via: "app" | "link" | "sistema";
  device?: string;
  target: string;
  summary: string;
  changes?: { field: string; from: string; to: string }[];
}

const ACTION_STYLE: Record<string, { label: string; cls: string; icon: string }> = {
  creata: { label: "Creata", cls: "bg-blue-100 text-blue-900", icon: "➕" },
  modificata: { label: "Modificata", cls: "bg-amber-100 text-amber-900", icon: "✏️" },
  eliminata: { label: "Eliminata", cls: "bg-red-100 text-red-900", icon: "🗑️" },
  completata: { label: "Fatta", cls: "bg-green-100 text-green-900", icon: "✅" },
  annullata: { label: "Annullata", cls: "bg-orange-100 text-orange-900", icon: "↩️" },
  disattivata: { label: "Disattivata", cls: "bg-slate-200 text-slate-800", icon: "⏸️" },
  riattivata: { label: "Riattivata", cls: "bg-slate-200 text-slate-800", icon: "▶️" },
  contratto: { label: "Contratto", cls: "bg-indigo-100 text-indigo-900", icon: "🏠" },
  impostazioni: { label: "Impostazioni", cls: "bg-slate-200 text-slate-800", icon: "⚙️" },
  password: { label: "Password", cls: "bg-purple-100 text-purple-900", icon: "🔑" },
  accesso: { label: "Accesso", cls: "bg-slate-100 text-slate-700", icon: "🔓" },
  avviso: { label: "Avviso inviato", cls: "bg-sky-100 text-sky-900", icon: "🔔" },
  backup: { label: "Backup", cls: "bg-slate-200 text-slate-800", icon: "💾" },
};

export function AuditLog({ notify }: { notify: Notify }) {
  const [list, setList] = useState<AuditEntry[] | null>(null);
  const [who, setWho] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [hideAccess, setHideAccess] = useState(true);
  const [limit, setLimit] = useState(50);

  const load = async () => {
    try {
      setList(await api<AuditEntry[]>("/api/audit"));
    } catch (e) {
      notify(`Errore: ${e instanceof Error ? e.message : e}`);
      setList([]);
    }
  };
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const people = useMemo(() => [...new Set((list ?? []).map((e) => e.actor))].sort(), [list]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list ?? []).filter(
      (e) =>
        (!who || e.actor === who) &&
        (!action || e.action === action) &&
        (!hideAccess || e.action !== "accesso" || action === "accesso") &&
        (!needle || `${e.target} ${e.summary} ${e.actor}`.toLowerCase().includes(needle)),
    );
  }, [list, who, action, q, hideAccess]);

  const exportExcel = async () => {
    const { default: writeExcelFile } = await import("write-excel-file/universal");
    const head = ["Data e ora", "Chi", "Come", "Azione", "Scadenza / elemento", "Dettagli"].map((value) => ({ value, fontWeight: "bold" as const }));
    const rows = filtered.map((e) => [
      { value: new Date(e.at).toLocaleString("it-IT", { timeZone: "Europe/Rome" }) },
      { value: e.actor },
      { value: e.via === "link" ? "Link ricevuto" : e.via === "sistema" ? "Automatico" : `App${e.device ? ` (${e.device})` : ""}` },
      { value: ACTION_STYLE[e.action]?.label ?? e.action },
      { value: e.target },
      { value: [e.summary, ...(e.changes ?? []).map((c) => `${c.field}: ${c.from} → ${c.to}`)].join("\n"), wrap: true },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = await writeExcelFile([head, ...rows] as any, { columns: [{ width: 20 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 45 }, { width: 70 }], sheet: "Diario", stickyRowsCount: 1 }).toBlob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "diario-scadenziario-greco.xlsx";
    a.click();
    notify("📊 Diario esportato in Excel");
  };

  return (
    <section className={card}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-2xl font-extrabold">Diario attività</h3>
          <p className="text-base text-slate-600">Tutto quello che viene fatto: chi, quando e cosa è cambiato.</p>
        </div>
        <button className="btn-ghost shrink-0 !px-3 !py-2" onClick={() => void load()} aria-label="Aggiorna">
          <RefreshCw className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <select className="field" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Chi">
          <option value="">Tutte le persone</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="field" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Tipo di azione">
          <option value="">Tutte le azioni</option>
          {Object.entries(ACTION_STYLE).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <input className="field" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca nel diario" />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" className="h-5 w-5" checked={hideAccess} onChange={(e) => setHideAccess(e.target.checked)} /> Nascondi gli accessi
        </label>
        <button className="btn-ghost !px-3 !py-2 text-base" onClick={() => void exportExcel()} disabled={!filtered.length}>
          <FileSpreadsheet className="h-5 w-5 text-green-700" aria-hidden /> Scarica Excel
        </button>
      </div>

      {list === null && <p className="py-8 text-center text-lg text-slate-500">Caricamento…</p>}
      {list && !filtered.length && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-lg text-slate-600">Nessuna attività registrata{list.length ? " con questi filtri" : " finora"}.</p>}

      <ol className="mt-4 space-y-3">
        {filtered.slice(0, limit).map((e) => {
          const st = ACTION_STYLE[e.action] ?? { label: e.action, cls: "bg-slate-100", icon: "•" };
          return (
            <li key={e.id} className="card-in rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`rounded-full px-2.5 py-0.5 font-bold ${st.cls}`}>{st.icon} {st.label}</span>
                <span className="font-semibold text-slate-800">{e.actor}</span>
                <span className="text-slate-500">
                  {new Date(e.at).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {e.via === "link" ? " · dal link ricevuto" : e.via === "sistema" ? " · automatico" : e.device ? ` · ${e.device}` : ""}
                </span>
              </div>
              <p className="mt-1 text-lg font-bold leading-snug">{e.target}</p>
              <p className="text-base text-slate-700">{e.summary}</p>
              {e.changes && e.changes.length > 0 && (
                <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2 text-base">
                  {e.changes.map((c, i) => (
                    <li key={i} className="[overflow-wrap:anywhere]">
                      <b>{c.field}:</b> <span className="text-red-700 line-through">{c.from}</span> → <span className="font-semibold text-green-800">{c.to}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      {filtered.length > limit && (
        <button className="btn-ghost mt-4 w-full" onClick={() => setLimit(limit + 100)}>
          Mostra altre {Math.min(100, filtered.length - limit)} attività
        </button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Dati e backup                                                       */
/* ------------------------------------------------------------------ */

export function DataSection({ notify }: { notify: Notify }) {
  const [storage, setStorage] = useState<{ kind: string; persistent: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ storage: { kind: string; persistent: boolean } }>("/api/deadlines").then((r) => setStorage(r.storage)).catch(() => undefined);
  }, []);

  const where: Record<string, string> = {
    "netlify-blobs": "sul server Netlify (Netlify Blobs)",
    supabase: "nel database Supabase",
    json: "in un file sul server",
    browser: "solo in questo browser (versione di prova)",
  };

  const download = async () => {
    setBusy(true);
    try {
      const data = await api<unknown>("/api/backup");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `scadenziario-greco-backup-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.json`;
      a.click();
      notify("💾 Copia di sicurezza scaricata");
    } catch (e) {
      notify(`Errore: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    if (!confirm("Ripristinare questa copia? Scadenze, contratti e impostazioni attuali verranno sostituiti da quelli del file.")) return;
    setBusy(true);
    try {
      const data = JSON.parse(await file.text());
      const r = await api<{ deadlines: number; contracts: number }>("/api/backup", "POST", data);
      notify(`✅ Ripristinate ${r.deadlines} scadenze e ${r.contracts} contratti. Ricarico…`);
      setTimeout(() => location.reload(), 1500);
    } catch (e) {
      notify(`Errore: ${e instanceof Error ? e.message : e}`);
      setBusy(false);
    }
  };

  return (
    <section className={card}>
      <h3 className="mb-1 text-2xl font-extrabold">I tuoi dati sono al sicuro</h3>
      <div className={`mt-2 rounded-xl p-4 text-lg ${storage && !storage.persistent ? "bg-amber-50 text-amber-900" : "bg-green-50 text-green-950"}`}>
        {storage ? (
          <>
            Tutto quello che fai viene salvato <b>{where[storage.kind] ?? storage.kind}</b>.
            {storage.persistent
              ? " Pubblicare una nuova versione dell'app non cancella né sovrascrive scadenze, storico, contratti, impostazioni e diario."
              : " Attenzione: in questa modalità i dati possono andare persi."}
          </>
        ) : (
          "Controllo in corso…"
        )}
      </div>
      <p className="mt-4 text-base text-slate-700">
        Per maggiore tranquillità scarica ogni tanto una <b>copia di sicurezza</b> (file .json): contiene scadenze, storico dei pagamenti con ricevute, contratti, impostazioni e diario.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button className="btn-green" onClick={() => void download()} disabled={busy}>
          <Download className="h-5 w-5" aria-hidden /> Scarica copia di sicurezza
        </button>
        <label className="btn-ghost cursor-pointer">
          <Upload className="h-5 w-5" aria-hidden /> Ripristina da una copia
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void restore(e.target.files?.[0])} disabled={busy} />
        </label>
      </div>
    </section>
  );
}
