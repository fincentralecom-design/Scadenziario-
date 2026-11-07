"use client";
import { useMemo, useState } from "react";
import { CircleCheckBig, Search, Undo2 } from "lucide-react";
import { formatShort } from "@/lib/dates";
import { bucketOf, formatEuro, sortByDate, type Bucket } from "@/lib/deadlines";
import { CATEGORY_LABELS, type Category, type Deadline } from "@/lib/types";
import { api, receiptUrl, type AppData } from "./api";
import CompleteDialog from "./CompleteDialog";
import DeadlineCard from "./DeadlineCard";

interface Props {
  data: AppData;
  reload: () => Promise<void>;
  notify: (m: string) => void;
  onEdit: (d: Deadline) => void;
}

type Filter = "all" | "red" | "orange" | "yellow" | "done";

const SECTIONS: { bucket: Bucket; title: string }[] = [
  { bucket: "red", title: "🔴 Scadono oggi / Scadute" },
  { bucket: "orange", title: "🟠 Scadono entro 3 giorni" },
  { bucket: "yellow", title: "🟡 Prossimi 30 giorni" },
  { bucket: "later", title: "⚪ Più avanti" },
];

const LATER_PREVIEW = 8;

export default function Dashboard({ data, reload, notify, onEdit }: Props) {
  const { today, deadlines } = data;
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<Category | "">("");
  const [q, setQ] = useState("");
  const [showAllLater, setShowAllLater] = useState(false);
  const [completing, setCompleting] = useState<{ d: Deadline; amount: number | null } | null>(null);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sortByDate(deadlines).filter(
      (d) =>
        d.active &&
        (!category || d.category === category) &&
        (!needle || `${d.title} ${d.description ?? ""} ${d.f24Code ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [deadlines, category, q]);

  const groups = useMemo(() => {
    const g: Record<Bucket, Deadline[]> = { red: [], orange: [], yellow: [], later: [], done: [], inactive: [] };
    visible.forEach((d) => g[bucketOf(d, today)].push(d));
    return g;
  }, [visible, today]);

  // Completate negli ultimi 30 giorni (dallo storico di tutte le scadenze).
  const completed = useMemo(() => {
    const since = Date.now() - 30 * 86_400_000;
    return deadlines
      .flatMap((d) => d.history.map((h, i) => ({ d, h, isLatest: i === 0 })))
      .filter((x) => Date.parse(x.h.completedAt) >= since)
      .sort((a, b) => b.h.completedAt.localeCompare(a.h.completedAt));
  }, [deadlines]);

  const tiles: { id: Filter; label: string; count: number; cls: string }[] = [
    { id: "red", label: "Scadono oggi / Scadute", count: groups.red.length, cls: "bg-red-600 text-white ring-red-800" },
    { id: "orange", label: "Scadono tra 3 giorni", count: groups.orange.length, cls: "bg-orange-500 text-white ring-orange-700" },
    { id: "yellow", label: "Prossimi 30 giorni", count: groups.yellow.length, cls: "bg-yellow-300 text-yellow-950 ring-yellow-600" },
    { id: "done", label: "Completate (30 gg)", count: completed.length, cls: "bg-green-600 text-white ring-green-800" },
  ];

  const complete = async (input: Parameters<React.ComponentProps<typeof CompleteDialog>["onConfirm"]>[0]) => {
    if (!completing) return;
    try {
      await api(`/api/deadlines/${completing.d.id}/complete`, "POST", input);
      notify("✅ Fatto! Scadenza registrata nello storico.");
      setCompleting(null);
      await reload();
    } catch (e) {
      notify(`Errore: ${e instanceof Error ? e.message : e}`);
    }
  };

  const undo = async (d: Deadline) => {
    if (!confirm(`Annullare l'ultimo completamento di "${d.title}"?`)) return;
    await api(`/api/deadlines/${d.id}/undo`, "POST");
    notify("Completamento annullato: la scadenza è di nuovo da fare.");
    await reload();
  };

  const saveAmount = async (d: Deadline, amount: number) => {
    await api(`/api/deadlines/${d.id}`, "PUT", { ...d, amount });
    notify(`Importo salvato: ${formatEuro(amount)}`);
    await reload();
  };

  const cardProps = { today, onComplete: (d: Deadline, amount: number | null) => setCompleting({ d, amount }), onEdit, onUndo: undo, onSaveAmount: saveAmount };

  return (
    <div>
      <section aria-label="Riepilogo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(filter === t.id ? "all" : t.id)}
            className={`rounded-2xl p-4 text-left shadow ${t.cls} ${filter === t.id ? "ring-4" : ""}`}
            aria-pressed={filter === t.id}
          >
            <span className="block text-4xl font-extrabold">{t.count}</span>
            <span className="block text-base font-bold leading-tight sm:text-lg">{t.label}</span>
          </button>
        ))}
      </section>
      <p className="mt-2 text-base text-slate-500">
        Oggi è {new Date(`${today}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.
        {filter !== "all" && (
          <button className="ml-2 font-semibold text-blue-700 underline" onClick={() => setFilter("all")}>Mostra tutto</button>
        )}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" aria-hidden />
          <input className="field !pl-12" placeholder="Cerca scadenza o codice tributo…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca" />
        </div>
        <select className="field sm:max-w-xs" value={category} onChange={(e) => setCategory(e.target.value as Category | "")} aria-label="Categoria">
          <option value="">Tutte le categorie</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {filter !== "done" &&
        SECTIONS.filter((s) => filter === "all" || s.bucket === filter).map((s) => {
          let list = groups[s.bucket];
          if (!list.length) return null;
          const hidden = s.bucket === "later" && !showAllLater ? Math.max(0, list.length - LATER_PREVIEW) : 0;
          if (hidden) list = list.slice(0, LATER_PREVIEW);
          return (
            <section key={s.bucket} className="mt-7">
              <h2 className="mb-3 text-2xl font-extrabold text-slate-900">
                {s.title} <span className="text-slate-500">({groups[s.bucket].length})</span>
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {list.map((d) => (
                  <DeadlineCard key={d.id} d={d} {...cardProps} />
                ))}
              </div>
              {hidden > 0 && (
                <button className="btn-ghost mt-4 w-full" onClick={() => setShowAllLater(true)}>
                  Mostra altre {hidden} scadenze
                </button>
              )}
            </section>
          );
        })}

      {filter !== "all" && filter !== "done" && !groups[filter].length && (
        <p className="mt-8 rounded-2xl bg-white p-6 text-center text-xl text-slate-600">Nessuna scadenza in questo gruppo. 👍</p>
      )}

      {(filter === "all" || filter === "done") && (
        <section className="mt-8">
          <h2 className="mb-3 text-2xl font-extrabold text-slate-900">🟢 Completate negli ultimi 30 giorni</h2>
          {groups.done.length > 0 && (
            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              {groups.done.map((d) => (
                <DeadlineCard key={d.id} d={d} {...cardProps} />
              ))}
            </div>
          )}
          {completed.length === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-lg text-slate-600">Ancora nessuna scadenza completata di recente.</p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              {completed.map(({ d, h, isLatest }) => (
                <li key={h.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                  <CircleCheckBig className="hidden h-7 w-7 shrink-0 text-green-700 sm:block" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-slate-900">{d.title}</p>
                    <p className="text-base text-slate-600">
                      Scadenza {formatShort(h.dueDate)} · fatto il {new Date(h.completedAt).toLocaleDateString("it-IT")}
                      {h.amountPaid ? ` · ${formatEuro(h.amountPaid)}` : ""}
                      {h.via === "magic-link" ? " · confermato dal link" : ""}
                    </p>
                    {h.note && <p className="text-base text-slate-600">📝 {h.note}</p>}
                  </div>
                  <div className="flex gap-2">
                    {h.hasReceipt && (
                      <a className="btn-ghost !py-2 text-base" href={receiptUrl(d.id, h.id)} target="_blank" rel="noreferrer">
                        Ricevuta
                      </a>
                    )}
                    {isLatest && (
                      <button className="btn-ghost !py-2 text-base" onClick={() => void undo(d)}>
                        <Undo2 className="h-5 w-5" aria-hidden /> Annulla
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {completing && (
        <CompleteDialog d={completing.d} suggestedAmount={completing.amount} onClose={() => setCompleting(null)} onConfirm={complete} />
      )}
    </div>
  );
}
