"use client";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, FileSpreadsheet, FileText, Filter, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { formatLong, formatShort } from "@/lib/dates";
import { daysLeft, effectiveDate, formatEuro, shiftReason, sortByDate } from "@/lib/deadlines";
import type { DeadlineDraft } from "@/lib/quickParse";
import { CATEGORY_LABELS, RECURRENCE_LABELS, type Calculator, type Category, type Deadline, type Recurrence } from "@/lib/types";
import { api, type AppData } from "./api";
import type { Notify } from "./feedback";
import Assistant from "./Assistant";
import { exportExcel, exportPdf } from "./exporters";

interface Props {
  data: AppData;
  reload: () => Promise<void>;
  notify: Notify;
  editing: Deadline | null;
  setEditing: (d: Deadline | null) => void;
}

interface FormState {
  title: string;
  category: Category;
  dueDate: string;
  recurrence: Recurrence;
  amount: string;
  f24Code: string;
  portal: string;
  description: string;
  notes: string;
  specialRule: string;
  shiftIfHoliday: boolean;
  active: boolean;
  calcType: "" | "percent" | "perUnit";
  calcValue: string;
  calcLabel: string;
  calcMin: string;
}

const EMPTY = (today: string): FormState => ({
  title: "",
  category: "altro",
  dueDate: today,
  recurrence: "una_tantum",
  amount: "",
  f24Code: "",
  portal: "",
  description: "",
  notes: "",
  specialRule: "",
  shiftIfHoliday: true,
  active: true,
  calcType: "",
  calcValue: "",
  calcLabel: "",
  calcMin: "",
});

const num = (s: string) => {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return s.trim() === "" || Number.isNaN(n) ? null : n;
};
const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

function fromDraft(d: DeadlineDraft, today: string): FormState {
  return {
    ...EMPTY(today),
    title: d.title,
    category: d.category,
    dueDate: d.dueDate,
    recurrence: d.recurrence,
    amount: str(d.amount),
    f24Code: d.f24Code ?? "",
    portal: d.portal ?? "",
    notes: d.notes ?? "",
    shiftIfHoliday: d.shiftIfHoliday,
  };
}

interface Filters {
  q: string;
  category: Category | "";
  recurrence: Recurrence | "";
  status: "" | "todo" | "late" | "next30" | "done" | "inactive";
  from: string;
  to: string;
  withAmount: boolean;
  sort: "date" | "title" | "amount";
}

const NO_FILTERS: Filters = { q: "", category: "", recurrence: "", status: "", from: "", to: "", withAmount: false, sort: "date" };

const STATUS_LABELS: Record<Exclude<Filters["status"], "">, string> = {
  todo: "Da fare",
  late: "Scadute / oggi",
  next30: "Prossimi 30 giorni",
  done: "Completate",
  inactive: "Disattivate",
};

function fromDeadline(d: Deadline): FormState {
  const c = d.calculator;
  return {
    title: d.title,
    category: d.category,
    dueDate: d.dueDate,
    recurrence: d.recurrence,
    amount: str(d.amount),
    f24Code: d.f24Code ?? "",
    portal: d.portal ?? "",
    description: d.description ?? "",
    notes: d.notes ?? "",
    specialRule: d.specialRule ?? "",
    shiftIfHoliday: d.shiftIfHoliday,
    active: d.active,
    calcType: c?.type ?? "",
    calcValue: c ? str(c.type === "percent" ? c.rate : c.unitAmount) : "",
    calcLabel: c ? (c.type === "percent" ? c.baseLabel : c.unitLabel) : "",
    calcMin: str(c?.min),
  };
}

/** I campi svuotati vengono inviati come null, così il server li cancella. */
function toPayload(f: FormState): Record<string, unknown> {
  let calculator: Calculator | null = null;
  const v = num(f.calcValue);
  if (f.calcType && v !== null) {
    const min = num(f.calcMin) ?? undefined;
    calculator =
      f.calcType === "percent"
        ? { type: "percent", rate: v, baseLabel: f.calcLabel || "Importo base (€)", min }
        : { type: "perUnit", unitAmount: v, unitLabel: f.calcLabel || "Quantità", min };
  }
  return {
    title: f.title,
    category: f.category,
    dueDate: f.dueDate,
    recurrence: f.recurrence,
    amount: num(f.amount),
    f24Code: f.f24Code.trim() || null,
    portal: f.portal.trim() || null,
    description: f.description.trim() || null,
    notes: f.notes.trim() || null,
    specialRule: f.specialRule.trim() || null,
    shiftIfHoliday: f.shiftIfHoliday,
    active: f.active,
    calculator,
  };
}

export default function DeadlineManager({ data, reload, notify, editing, setEditing }: Props) {
  const [form, setForm] = useState<FormState>(() => (editing ? fromDeadline(editing) : EMPTY(data.today)));
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState<"" | "xlsx" | "pdf">("");
  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    setForm(editing ? fromDeadline(editing) : EMPTY(data.today));
  }, [editing, data.today]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const preview = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) return null;
    const p = { dueDate: form.dueDate, shiftIfHoliday: form.shiftIfHoliday };
    return { eff: effectiveDate(p), reason: shiftReason(p) };
  }, [form.dueDate, form.shiftIfHoliday]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await api(`/api/deadlines/${editing.id}`, "PUT", toPayload(form));
        notify("💾 Modifiche salvate");
      } else {
        await api("/api/deadlines", "POST", toPayload(form));
        notify("➕ Nuova scadenza aggiunta");
      }
      setEditing(null);
      setForm(EMPTY(data.today));
      await reload();
    } catch (err) {
      notify(`Errore: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (d: Deadline) => {
    await api(`/api/deadlines/${d.id}`, "PUT", { ...d, active: !d.active });
    notify(d.active ? "Scadenza disattivata (non riceverai avvisi)" : "Scadenza riattivata");
    await reload();
  };

  const remove = async (d: Deadline) => {
    if (!confirm(`Eliminare definitivamente "${d.title}"? Verrà cancellato anche lo storico.\nSe vuoi solo sospenderla usa "Disattiva".`)) return;
    await api(`/api/deadlines/${d.id}`, "DELETE");
    if (editing?.id === d.id) setEditing(null);
    notify("🗑️ Scadenza eliminata");
    await reload();
  };

  const list = useMemo(() => {
    const needle = f.q.trim().toLowerCase();
    const out = sortByDate(data.deadlines).filter((d) => {
      const eff = effectiveDate(d);
      if (needle && !`${d.title} ${d.description ?? ""} ${d.notes ?? ""} ${d.f24Code ?? ""} ${d.portal ?? ""}`.toLowerCase().includes(needle)) return false;
      if (f.category && d.category !== f.category) return false;
      if (f.recurrence && d.recurrence !== f.recurrence) return false;
      if (f.from && eff < f.from) return false;
      if (f.to && eff > f.to) return false;
      if (f.withAmount && !d.amount) return false;
      const todo = d.active && d.status === "todo";
      switch (f.status) {
        case "todo": return todo;
        case "late": return todo && daysLeft(d, data.today) <= 0;
        case "next30": return todo && daysLeft(d, data.today) >= 0 && daysLeft(d, data.today) <= 30;
        case "done": return d.status === "done" || d.history.length > 0;
        case "inactive": return !d.active;
        default: return true;
      }
    });
    if (f.sort === "title") out.sort((a, b) => a.title.localeCompare(b.title, "it"));
    if (f.sort === "amount") out.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
    return out;
  }, [data.deadlines, data.today, f]);

  const activeCount = (Object.keys(NO_FILTERS) as (keyof Filters)[]).filter((k) => k !== "sort" && f[k] !== NO_FILTERS[k]).length;
  const filtersLabel = [
    f.q && `testo “${f.q}”`,
    f.category && CATEGORY_LABELS[f.category],
    f.recurrence && RECURRENCE_LABELS[f.recurrence],
    f.status && STATUS_LABELS[f.status],
    f.from && `dal ${formatShort(f.from)}`,
    f.to && `al ${formatShort(f.to)}`,
    f.withAmount && "con importo",
  ]
    .filter(Boolean)
    .join(", ");
  const total = list.reduce((sum, d) => sum + (d.amount ?? 0), 0);

  const doExport = async (kind: "xlsx" | "pdf") => {
    if (!list.length) return notify("Nessuna scadenza da esportare con questi filtri.");
    setExporting(kind);
    try {
      if (kind === "xlsx") await exportExcel(list, data.today);
      else await exportPdf(list, data.today, filtersLabel);
      notify(kind === "xlsx" ? "📊 File Excel creato" : "📄 PDF creato");
    } catch (e) {
      notify(`Errore nell'esportazione: ${e instanceof Error ? e.message : e}`);
    } finally {
      setExporting("");
    }
  };

  return (
    <>
    <Assistant
      notify={notify}
      reload={reload}
      onUseInForm={(d) => {
        setEditing(null);
        setTimeout(() => {
          setForm(fromDraft(d, data.today));
          document.getElementById("modulo-scadenza")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      }}
    />
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <form id="modulo-scadenza" onSubmit={save} className="scroll-mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold">
          {editing ? <Pencil className="h-7 w-7" aria-hidden /> : <Plus className="h-7 w-7" aria-hidden />}
          {editing ? "Modifica scadenza" : "Aggiungi nuova scadenza"}
        </h2>
        {editing?.contractId && (
          <p className="mb-4 rounded-xl bg-amber-50 p-3 text-base text-amber-900">
            Questa scadenza è generata da un contratto: se modifichi il contratto in “Affitti &amp; Bolli” verrà ricalcolata.
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="f-title">Titolo *</label>
            <input id="f-title" className="field" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Es. Rinnovo assicurazione struttura" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="f-cat">Categoria</label>
              <select id="f-cat" className="field" value={form.category} onChange={(e) => set("category", e.target.value as Category)}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="f-rec">Ricorrenza</label>
              <select id="f-rec" className="field" value={form.recurrence} onChange={(e) => set("recurrence", e.target.value as Recurrence)}>
                {Object.entries(RECURRENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="f-date">Data di scadenza *</label>
            <input id="f-date" type="date" className="field" required value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            <label className="mt-2 flex items-center gap-3 text-lg">
              <input type="checkbox" className="h-6 w-6" checked={form.shiftIfHoliday} onChange={(e) => set("shiftIfHoliday", e.target.checked)} />
              Se cade di sabato, domenica o festivo sposta al primo giorno lavorativo
            </label>
            {preview && preview.reason && (
              <p className="mt-1 text-base font-semibold text-blue-800">
                Il {formatShort(form.dueDate)} è {preview.reason}: data utile {formatLong(preview.eff)}.
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="f-amount">Importo stimato (€)</label>
              <input id="f-amount" inputMode="decimal" className="field" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="Es. 150,00" />
            </div>
            <div>
              <label className="label" htmlFor="f-f24">Codice tributo F24</label>
              <input id="f-f24" className="field" value={form.f24Code} onChange={(e) => set("f24Code", e.target.value)} placeholder="Es. 3918" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="f-portal">Dove / portale da usare</label>
            <input id="f-portal" className="field" value={form.portal} onChange={(e) => set("portal", e.target.value)} placeholder="Es. Home banking, portale comunale…" />
          </div>
          <div>
            <label className="label" htmlFor="f-desc">Descrizione</label>
            <textarea id="f-desc" rows={3} className="field" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-notes">Note operative</label>
            <textarea id="f-notes" rows={2} className="field" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-rule">Regola speciale (mostrata in evidenza)</label>
            <input id="f-rule" className="field" value={form.specialRule} onChange={(e) => set("specialRule", e.target.value)} placeholder="Es. Se l'importo è inferiore a … può slittare al …" />
          </div>

          <fieldset className="rounded-xl border-2 border-dashed border-slate-300 p-4">
            <legend className="px-2 text-base font-bold">Calcolatore rapido (facoltativo)</legend>
            <select className="field" value={form.calcType} onChange={(e) => set("calcType", e.target.value as FormState["calcType"])} aria-label="Tipo di calcolatore">
              <option value="">Nessun calcolatore</option>
              <option value="percent">Percentuale su un importo (es. 22% IVA, 2% registro)</option>
              <option value="perUnit">Importo fisso × quantità (es. 2 € × fatture)</option>
            </select>
            {form.calcType && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="f-cv">{form.calcType === "percent" ? "Percentuale %" : "Importo unitario €"}</label>
                  <input id="f-cv" inputMode="decimal" className="field" value={form.calcValue} onChange={(e) => set("calcValue", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="f-cl">Cosa si inserisce</label>
                  <input id="f-cl" className="field" value={form.calcLabel} onChange={(e) => set("calcLabel", e.target.value)} placeholder={form.calcType === "percent" ? "Es. Commissioni del mese (€)" : "Es. Numero fatture"} />
                </div>
                <div>
                  <label className="label" htmlFor="f-cm">Minimo €</label>
                  <input id="f-cm" inputMode="decimal" className="field" value={form.calcMin} onChange={(e) => set("calcMin", e.target.value)} />
                </div>
              </div>
            )}
          </fieldset>

          <label className="flex items-center gap-3 text-lg">
            <input type="checkbox" className="h-6 w-6" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
            Attiva (ricevo gli avvisi)
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="submit" className="btn-green flex-1 py-4 text-xl" disabled={busy}>
            <Save className="h-6 w-6" aria-hidden /> {editing ? "Salva modifiche" : "Aggiungi scadenza"}
          </button>
          {editing && (
            <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Annulla modifica</button>
          )}
        </div>
      </form>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-3 text-2xl font-extrabold">
          Elenco scadenze <span className="text-slate-500">({list.length}{list.length !== data.deadlines.length ? ` di ${data.deadlines.length}` : ""})</span>
        </h2>
        <input className="field" placeholder="Cerca per nome, codice, note…" value={f.q} onChange={(e) => setFilter("q", e.target.value)} aria-label="Cerca nell'elenco" />

        <div className="mt-3 flex flex-wrap gap-2">
          <button className={`btn-ghost !px-3 !py-2 text-base ${activeCount ? "!border-blue-600 !text-blue-800" : ""}`} onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
            <Filter className="h-5 w-5" aria-hidden /> Filtri{activeCount ? ` (${activeCount})` : ""}
          </button>
          <button className="btn-ghost !px-3 !py-2 text-base" onClick={() => void doExport("xlsx")} disabled={!!exporting}>
            <FileSpreadsheet className="h-5 w-5 text-green-700" aria-hidden /> {exporting === "xlsx" ? "Creo…" : "Excel"}
          </button>
          <button className="btn-ghost !px-3 !py-2 text-base" onClick={() => void doExport("pdf")} disabled={!!exporting}>
            <FileText className="h-5 w-5 text-red-700" aria-hidden /> {exporting === "pdf" ? "Creo…" : "PDF"}
          </button>
        </div>

        <div className={`grid transition-all duration-300 ${showFilters ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="flt-status">Stato</label>
                <select id="flt-status" className="field" value={f.status} onChange={(e) => setFilter("status", e.target.value as Filters["status"])}>
                  <option value="">Tutti</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="flt-cat">Categoria</label>
                <select id="flt-cat" className="field" value={f.category} onChange={(e) => setFilter("category", e.target.value as Category | "")}>
                  <option value="">Tutte</option>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="flt-rec">Ricorrenza</label>
                <select id="flt-rec" className="field" value={f.recurrence} onChange={(e) => setFilter("recurrence", e.target.value as Recurrence | "")}>
                  <option value="">Tutte</option>
                  {Object.entries(RECURRENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="flt-sort">Ordina per</label>
                <select id="flt-sort" className="field" value={f.sort} onChange={(e) => setFilter("sort", e.target.value as Filters["sort"])}>
                  <option value="date">Data di scadenza</option>
                  <option value="title">Nome (A-Z)</option>
                  <option value="amount">Importo (dal più alto)</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="flt-from">Dal giorno</label>
                <input id="flt-from" type="date" className="field" value={f.from} onChange={(e) => setFilter("from", e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="flt-to">Al giorno</label>
                <input id="flt-to" type="date" className="field" value={f.to} onChange={(e) => setFilter("to", e.target.value)} />
              </div>
              <label className="flex items-center gap-3 text-lg sm:col-span-2">
                <input type="checkbox" className="h-6 w-6" checked={f.withAmount} onChange={(e) => setFilter("withAmount", e.target.checked)} />
                Solo scadenze con importo
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                {[
                  { label: "Questo mese", from: data.today.slice(0, 8) + "01", to: data.today.slice(0, 8) + "31" },
                  { label: "Prossimi 3 mesi", from: data.today, to: new Date(Date.parse(data.today) + 92 * 86_400_000).toISOString().slice(0, 10) },
                  { label: `Anno ${data.today.slice(0, 4)}`, from: `${data.today.slice(0, 4)}-01-01`, to: `${data.today.slice(0, 4)}-12-31` },
                ].map((p) => (
                  <button key={p.label} className="rounded-full border-2 border-slate-300 bg-white px-3 py-1.5 text-base font-semibold active:bg-slate-100" onClick={() => setF((x) => ({ ...x, from: p.from, to: p.to }))}>
                    {p.label}
                  </button>
                ))}
                {activeCount > 0 && (
                  <button className="flex items-center gap-1 rounded-full border-2 border-red-200 bg-white px-3 py-1.5 text-base font-semibold text-red-700" onClick={() => setF(NO_FILTERS)}>
                    <RotateCcw className="h-4 w-4" aria-hidden /> Azzera filtri
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {total > 0 && <p className="mt-3 text-base text-slate-700">Totale importi in elenco: <b>{formatEuro(total)}</b></p>}
        {!list.length && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-lg text-slate-600">Nessuna scadenza con questi filtri.</p>}

        <ul className="mt-2 divide-y divide-slate-200">
          {list.map((d) => (
            <li key={d.id} className={`flex flex-col gap-2 py-3 ${d.active ? "" : "opacity-60"}`}>
              <div>
                <p className="text-lg font-bold leading-snug">{d.title}</p>
                <p className="text-base text-slate-600">
                  {d.status === "done" ? "Completata" : formatShort(effectiveDate(d))} · {RECURRENCE_LABELS[d.recurrence]} · {CATEGORY_LABELS[d.category]}
                  {d.amount ? ` · ${formatEuro(d.amount)}` : ""}
                  {!d.active && " · DISATTIVATA"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost !px-3 !py-2 text-base" onClick={() => setEditing(d)}>
                  <Pencil className="h-5 w-5" aria-hidden /> Modifica
                </button>
                <button className="btn-ghost !px-3 !py-2 text-base" onClick={() => void toggleActive(d)}>
                  {d.active ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                  {d.active ? "Disattiva" : "Riattiva"}
                </button>
                <button className="btn-red !px-3 !py-2 text-base" onClick={() => void remove(d)}>
                  <Trash2 className="h-5 w-5" aria-hidden /> Elimina
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
    </>
  );
}
