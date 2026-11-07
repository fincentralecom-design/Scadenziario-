"use client";
import { useMemo, useState } from "react";
import { Building2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { formatShort } from "@/lib/dates";
import { bolloContratto, currentPeriodEnd, generateContractDeadlines, registroAnnuo } from "@/lib/contracts";
import { effectiveDate, f24CodeFor, formatEuro, sortByDate } from "@/lib/deadlines";
import type { Contract } from "@/lib/types";
import { api, type AppData } from "./api";

interface Props {
  data: AppData;
  reload: () => Promise<void>;
  notify: (m: string) => void;
}

type Form = {
  tenant: string;
  property: string;
  startDate: string;
  annualRent: string;
  cedolare: boolean;
  type: "4+4" | "3+2" | "custom";
  initialYears: string;
  renewalYears: string;
  facciate: string;
  copie: string;
  alreadyRegistered: boolean;
  notes: string;
};

const empty = (today: string): Form => ({
  tenant: "",
  property: "",
  startDate: today,
  annualRent: "",
  cedolare: true,
  type: "4+4",
  initialYears: "4",
  renewalYears: "4",
  facciate: "4",
  copie: "1",
  alreadyRegistered: false,
  notes: "",
});

const n = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;

function toContract(f: Form): Omit<Contract, "id" | "createdAt" | "updatedAt" | "active"> {
  const [iy, ry] = f.type === "4+4" ? [4, 4] : f.type === "3+2" ? [3, 2] : [n(f.initialYears) || 1, n(f.renewalYears) || 1];
  return {
    tenant: f.tenant,
    property: f.property,
    startDate: f.startDate,
    annualRent: n(f.annualRent),
    cedolare: f.cedolare,
    initialYears: iy,
    renewalYears: ry,
    facciate: n(f.facciate) || 1,
    copie: n(f.copie) || 1,
    alreadyRegistered: f.alreadyRegistered,
    notes: f.notes || undefined,
  };
}

function fromContract(c: Contract): Form {
  const type = c.initialYears === 4 && c.renewalYears === 4 ? "4+4" : c.initialYears === 3 && c.renewalYears === 2 ? "3+2" : "custom";
  return {
    tenant: c.tenant,
    property: c.property,
    startDate: c.startDate,
    annualRent: String(c.annualRent).replace(".", ","),
    cedolare: c.cedolare,
    type,
    initialYears: String(c.initialYears),
    renewalYears: String(c.renewalYears),
    facciate: String(c.facciate),
    copie: String(c.copie),
    alreadyRegistered: c.alreadyRegistered,
    notes: c.notes ?? "",
  };
}

export default function Contracts({ data, reload, notify }: Props) {
  const [form, setForm] = useState<Form>(empty(data.today));
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Anteprima live delle scadenze che verranno generate.
  const preview = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startDate)) return [];
    const c: Contract = { ...toContract(form), tenant: form.tenant || "Inquilino", property: form.property || "Immobile", id: "preview", active: true, createdAt: "", updatedAt: "" };
    return generateContractDeadlines(c, data.today);
  }, [form, data.today]);

  const rent = n(form.annualRent);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editId) await api(`/api/contracts/${editId}`, "PUT", toContract(form));
      else await api("/api/contracts", "POST", toContract(form));
      notify(editId ? "💾 Contratto aggiornato e scadenze ricalcolate" : "🏠 Contratto aggiunto: scadenze generate in automatico");
      setForm(empty(data.today));
      setEditId(null);
      await reload();
    } catch (err) {
      notify(`Errore: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Contract) => {
    if (!confirm(`Eliminare il contratto di ${c.tenant} e tutte le scadenze collegate?`)) return;
    await api(`/api/contracts/${c.id}`, "DELETE");
    notify("🗑️ Contratto eliminato");
    await reload();
  };

  const edit = (c: Contract) => {
    setEditId(c.id);
    setForm(fromContract(c));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-1 flex items-center gap-2 text-2xl font-extrabold">
          {editId ? <Pencil className="h-7 w-7" aria-hidden /> : <Plus className="h-7 w-7" aria-hidden />}
          {editId ? "Modifica contratto" : "Nuovo contratto di affitto"}
        </h2>
        <p className="mb-4 text-base text-slate-600">Inserisci i dati: le scadenze di registro, bollo, proroga e disdetta vengono create da sole.</p>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="c-tenant">Nome inquilino *</label>
            <input id="c-tenant" className="field" required value={form.tenant} onChange={(e) => set("tenant", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="c-prop">Immobile *</label>
            <input id="c-prop" className="field" required value={form.property} onChange={(e) => set("property", e.target.value)} placeholder="Es. Via Roma 10, int. 3" />
          </div>
          <div>
            <label className="label" htmlFor="c-start">Data di decorrenza *</label>
            <input id="c-start" type="date" className="field" required value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="c-rent">Canone annuo (€) *</label>
            <input id="c-rent" inputMode="decimal" className="field" required value={form.annualRent} onChange={(e) => set("annualRent", e.target.value)} placeholder="Es. 7200" />
          </div>
          <div>
            <span className="label">Regime cedolare secca?</span>
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => set("cedolare", v)}
                  className={`rounded-xl border-2 py-3 text-lg font-bold ${form.cedolare === v ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}
                  aria-pressed={form.cedolare === v}
                >
                  {v ? "Sì" : "No"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="c-type">Tipo di contratto</label>
            <select id="c-type" className="field" value={form.type} onChange={(e) => set("type", e.target.value as Form["type"])}>
              <option value="4+4">Libero 4+4 anni</option>
              <option value="3+2">Concordato 3+2 anni</option>
              <option value="custom">Altra durata (transitorio, studenti…)</option>
            </select>
          </div>
          {form.type === "custom" && (
            <>
              <div>
                <label className="label" htmlFor="c-iy">Durata primo periodo (anni)</label>
                <input id="c-iy" inputMode="numeric" className="field" value={form.initialYears} onChange={(e) => set("initialYears", e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="c-ry">Durata rinnovo (anni)</label>
                <input id="c-ry" inputMode="numeric" className="field" value={form.renewalYears} onChange={(e) => set("renewalYears", e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className="label" htmlFor="c-fac">Facciate del contratto (per il bollo)</label>
            <input id="c-fac" inputMode="numeric" className="field" value={form.facciate} onChange={(e) => set("facciate", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="c-cop">Copie soggette a bollo</label>
            <input id="c-cop" inputMode="numeric" className="field" value={form.copie} onChange={(e) => set("copie", e.target.value)} />
          </div>
          <label className="flex items-center gap-3 text-lg md:col-span-2">
            <input type="checkbox" className="h-6 w-6" checked={form.alreadyRegistered} onChange={(e) => set("alreadyRegistered", e.target.checked)} />
            Contratto già registrato (non creare la scadenza di prima registrazione RLI)
          </label>
          <div className="md:col-span-2">
            <label className="label" htmlFor="c-notes">Note</label>
            <input id="c-notes" className="field" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Es. codice identificativo contratto TXX12A…" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-lg sm:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">Imposta di registro annua (2%, min. 67 €)</p>
            <p className="text-2xl font-extrabold">{form.cedolare ? "0 € (cedolare)" : formatEuro(rent ? registroAnnuo(rent) : null)}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Bollo registrazione (16 € / 4 facciate)</p>
            <p className="text-2xl font-extrabold">{form.cedolare ? "0 € (cedolare)" : formatEuro(bolloContratto(n(form.facciate), n(form.copie)))}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Fine periodo contrattuale in corso</p>
            <p className="text-2xl font-extrabold">
              {/^\d{4}-\d{2}-\d{2}$/.test(form.startDate) ? formatShort(currentPeriodEnd({ ...toContract(form), id: "", active: true, createdAt: "", updatedAt: "" }, data.today).end) : "—"}
            </p>
          </div>
        </div>

        {preview.length > 0 && (
          <div className="mt-4">
            <p className="label">Scadenze che verranno create:</p>
            <ul className="space-y-1 text-base text-slate-700">
              {preview.map((d) => (
                <li key={d.id}>
                  • <b>{formatShort(effectiveDate(d))}</b> – {d.title.split(" – ")[0]}
                  {d.amount ? ` – ${formatEuro(d.amount)}` : ""}
                  {d.recurrence === "annuale" ? " (ogni anno)" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button type="submit" className="btn-green flex-1 py-4 text-xl" disabled={busy}>
            <Save className="h-6 w-6" aria-hidden /> {editId ? "Salva e ricalcola scadenze" : "Aggiungi contratto"}
          </button>
          {editId && (
            <button type="button" className="btn-ghost" onClick={() => { setEditId(null); setForm(empty(data.today)); }}>
              Annulla modifica
            </button>
          )}
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-2xl font-extrabold">Contratti attivi ({data.contracts.length})</h2>
        {data.contracts.length === 0 && <p className="rounded-2xl bg-white p-5 text-lg text-slate-600">Nessun contratto inserito.</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          {data.contracts.map((c) => {
            const linked = sortByDate(data.deadlines.filter((d) => d.contractId === c.id && d.active));
            return (
              <article key={c.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h3 className="flex items-center gap-2 text-xl font-extrabold">
                  <Building2 className="h-6 w-6 shrink-0" aria-hidden /> {c.tenant}
                </h3>
                <p className="text-lg text-slate-700">{c.property}</p>
                <p className="mt-1 text-base text-slate-600">
                  Dal {formatShort(c.startDate)} · {c.initialYears}+{c.renewalYears} anni · Canone {formatEuro(c.annualRent)}/anno ·{" "}
                  {c.cedolare ? "Cedolare secca" : "Regime ordinario"}
                </p>
                <ul className="mt-3 divide-y divide-slate-100 rounded-xl bg-slate-50">
                  {linked.map((d) => (
                    <li key={d.id} className="p-3 text-base">
                      <p className="font-bold">{d.title.split(" – ")[0]}</p>
                      <p className="text-slate-600">
                        {d.status === "done" ? "✅ Completata" : `Entro ${formatShort(effectiveDate(d))}`}
                        {d.amount ? ` · ${formatEuro(d.amount)}` : ""}
                        {f24CodeFor(d) ? ` · F24: ${f24CodeFor(d)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn-ghost" onClick={() => edit(c)}>
                    <Pencil className="h-5 w-5" aria-hidden /> Modifica
                  </button>
                  <button className="btn-red" onClick={() => void remove(c)}>
                    <Trash2 className="h-5 w-5" aria-hidden /> Elimina
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
