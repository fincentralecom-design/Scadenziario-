"use client";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { formatLong, formatShort } from "@/lib/dates";
import { effectiveDate, shiftReason, sortByDate } from "@/lib/deadlines";
import { CATEGORY_LABELS, RECURRENCE_LABELS, type Calculator, type Category, type Deadline, type Recurrence } from "@/lib/types";
import { api, type AppData } from "./api";
import type { Notify } from "./feedback";

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
  const [q, setQ] = useState("");

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

  const list = sortByDate(data.deadlines).filter((d) => !q || d.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <form onSubmit={save} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
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
        <h2 className="mb-3 text-2xl font-extrabold">Tutte le scadenze ({data.deadlines.length})</h2>
        <input className="field mb-3" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca nell'elenco" />
        <ul className="divide-y divide-slate-200">
          {list.map((d) => (
            <li key={d.id} className={`flex flex-col gap-2 py-3 ${d.active ? "" : "opacity-60"}`}>
              <div>
                <p className="text-lg font-bold leading-snug">{d.title}</p>
                <p className="text-base text-slate-600">
                  {d.status === "done" ? "Completata" : formatShort(effectiveDate(d))} · {RECURRENCE_LABELS[d.recurrence]} · {CATEGORY_LABELS[d.category]}
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
  );
}
