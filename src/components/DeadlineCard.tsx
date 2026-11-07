"use client";
import { useState } from "react";
import { CalendarPlus, Calculator, ChevronDown, CircleCheckBig, Globe, History, Pencil, Receipt, Undo2 } from "lucide-react";
import { formatLong, formatShort } from "@/lib/dates";
import { bucketOf, calculate, daysLeft, effectiveDate, f24CodeFor, formatEuro, shiftReason, type Bucket } from "@/lib/deadlines";
import { downloadCalendar } from "./api";
import { CATEGORY_LABELS, RECURRENCE_LABELS, type Deadline } from "@/lib/types";

export const BUCKET_STYLE: Record<Bucket, { border: string; badge: string; label: string }> = {
  red: { border: "border-l-red-600", badge: "bg-red-600 text-white", label: "Scade oggi / scaduta" },
  orange: { border: "border-l-orange-500", badge: "bg-orange-500 text-white", label: "Entro 3 giorni" },
  yellow: { border: "border-l-yellow-400", badge: "bg-yellow-300 text-yellow-950", label: "Entro 30 giorni" },
  later: { border: "border-l-slate-300", badge: "bg-slate-200 text-slate-800", label: "Più avanti" },
  done: { border: "border-l-green-600", badge: "bg-green-600 text-white", label: "Completata" },
  inactive: { border: "border-l-slate-200", badge: "bg-slate-100 text-slate-500", label: "Disattivata" },
};

export function whenText(n: number): string {
  if (n === 0) return "SCADE OGGI";
  if (n === 1) return "domani";
  if (n > 1) return `tra ${n} giorni`;
  return n === -1 ? "scaduta da 1 giorno" : `scaduta da ${-n} giorni`;
}

interface Props {
  d: Deadline;
  today: string;
  onComplete: (d: Deadline, suggestedAmount: number | null) => void;
  onEdit: (d: Deadline) => void;
  onUndo: (d: Deadline) => void;
  onSaveAmount: (d: Deadline, amount: number) => void;
}

export default function DeadlineCard({ d, today, onComplete, onEdit, onUndo, onSaveAmount }: Props) {
  const [base, setBase] = useState("");
  const [open, setOpen] = useState(false);
  const bucket = bucketOf(d, today);
  const st = BUCKET_STYLE[bucket];
  const due = effectiveDate(d);
  const n = daysLeft(d, today);
  const shifted = shiftReason(d);
  const code = f24CodeFor(d);
  const baseNum = Number(base.replace(/\./g, "").replace(",", "."));
  const calcResult = d.calculator && base && !Number.isNaN(baseNum) ? calculate(d.calculator, baseNum) : null;
  const lastDone = d.history[0];

  return (
    <article className={`card-in overflow-hidden rounded-2xl border-l-[10px] bg-white shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md ${st.border}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="block w-full p-4 text-left sm:p-5"
        aria-expanded={open}
        aria-controls={`det-${d.id}`}
      >
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${st.badge}`}>{d.status === "todo" && d.active ? whenText(n) : st.label}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{CATEGORY_LABELS[d.category]}</span>
          </div>
          <ChevronDown className={`mt-1 h-7 w-7 shrink-0 text-slate-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
        </div>
        <h3 className="mt-2 text-xl font-extrabold leading-snug text-slate-900">{d.title}</h3>
        <p className="mt-1 text-lg">
          <span className="font-semibold text-slate-600">Entro: </span>
          <span className="inline-block font-extrabold text-slate-900 first-letter:uppercase">{formatLong(due)}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-base text-slate-700">
          <span>
            💶 <b>{d.amount ? formatEuro(d.amount) : d.calculator ? "Variabile" : "—"}</b>
          </span>
          {code && (
            <span className="max-w-full truncate">
              🧾 F24 <b>{code}</b>
            </span>
          )}
        </div>
        {!open && <span className="mt-2 inline-block text-base font-semibold text-blue-700">Tocca per dettagli e note</span>}
      </button>

      <div id={`det-${d.id}`} className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-3 px-4 pb-1 sm:px-5">
            <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{RECURRENCE_LABELS[d.recurrence]}</span>
            {shifted && (
              <p className="text-base text-slate-600">Data spostata dal {formatShort(d.dueDate)} ({shifted}) al primo giorno lavorativo.</p>
            )}
            {code && code.length > 30 && <p className="text-base text-slate-700">🧾 <b>Codice F24:</b> {code}</p>}
            {d.portal && (
              <p className="flex items-start gap-2 text-base text-slate-700">
                <Globe className="mt-1 h-5 w-5 shrink-0" aria-hidden /> <span><b>Dove:</b> {d.portal}</span>
              </p>
            )}
            {d.specialRule && <p className="rounded-xl border-l-4 border-blue-600 bg-blue-50 p-3 text-base text-blue-950">ℹ️ {d.specialRule}</p>}
            {d.description && <p className="text-base text-slate-700">{d.description}</p>}
            {d.notes && <p className="rounded-lg bg-amber-50 p-2 text-base text-amber-950">📝 {d.notes}</p>}

            {d.calculator && d.status === "todo" && (
              <div className="rounded-xl border-2 border-dashed border-slate-300 p-3">
                <label className="label flex items-center gap-2" htmlFor={`calc-${d.id}`}>
                  <Calculator className="h-5 w-5 shrink-0" aria-hidden />
                  {d.calculator.type === "percent" ? d.calculator.baseLabel : d.calculator.unitLabel}
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id={`calc-${d.id}`}
                    inputMode="decimal"
                    className="field max-w-[11rem]"
                    placeholder={d.calculator.type === "percent" ? "Es. 1250,00" : "Es. 15"}
                    value={base}
                    onChange={(e) => setBase(e.target.value)}
                  />
                  <span className="text-lg text-slate-600">
                    {d.calculator.type === "percent" ? `× ${d.calculator.rate}%` : `× ${formatEuro(d.calculator.unitAmount)}`}
                    {d.calculator.min ? ` (min. ${formatEuro(d.calculator.min)})` : ""} =
                  </span>
                  <span key={calcResult ?? "x"} className="pop-in text-2xl font-extrabold text-slate-900">{formatEuro(calcResult)}</span>
                  {calcResult !== null && calcResult > 0 && (
                    <button className="btn-ghost !py-2 text-base" onClick={() => onSaveAmount(d, calcResult)}>Usa come importo</button>
                  )}
                </div>
              </div>
            )}

            {lastDone && (
              <p className="flex items-center gap-2 text-base text-green-800">
                <History className="h-5 w-5 shrink-0" aria-hidden />
                Ultima volta fatto il {new Date(lastDone.completedAt).toLocaleDateString("it-IT")}
                {lastDone.amountPaid ? ` (${formatEuro(lastDone.amountPaid)})` : ""}
                {lastDone.receiptName && <Receipt className="h-5 w-5" aria-label="ricevuta allegata" />}
              </p>
            )}

            <button className="btn-ghost w-full !px-3 text-base" onClick={() => downloadCalendar(d.id)}>
              <CalendarPlus className="h-5 w-5" aria-hidden /> Aggiungi al Calendario (con promemoria)
            </button>
            <div className="grid grid-cols-2 gap-2 pb-3">
              <button className="btn-ghost !px-3 text-base" onClick={() => onEdit(d)}>
                <Pencil className="h-5 w-5" aria-hidden /> Modifica
              </button>
              {lastDone ? (
                <button className="btn-ghost !px-3 text-base" onClick={() => onUndo(d)} title="Annulla l'ultimo completamento">
                  <Undo2 className="h-5 w-5" aria-hidden /> Annulla ultimo
                </button>
              ) : <span />}
            </div>
          </div>
        </div>
      </div>

      {d.status === "todo" && d.active && (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <button className="btn-green w-full py-4 text-xl" onClick={() => onComplete(d, calcResult ?? d.amount ?? null)}>
            <CircleCheckBig className="h-7 w-7" aria-hidden /> SEGNA COME PAGATO / FATTO
          </button>
        </div>
      )}
    </article>
  );
}
