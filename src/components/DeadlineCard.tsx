"use client";
import { useState } from "react";
import { Calculator, CircleCheckBig, Globe, History, Pencil, Receipt, Undo2 } from "lucide-react";
import { formatLong, formatShort } from "@/lib/dates";
import { bucketOf, calculate, daysLeft, effectiveDate, f24CodeFor, formatEuro, shiftReason, type Bucket } from "@/lib/deadlines";
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
  const [showMore, setShowMore] = useState(false);
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
    <article className={`rounded-2xl border-l-[10px] bg-white p-5 shadow-sm ring-1 ring-slate-200 ${st.border}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${st.badge}`}>{d.status === "todo" && d.active ? whenText(n) : st.label}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{CATEGORY_LABELS[d.category]}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{RECURRENCE_LABELS[d.recurrence]}</span>
      </div>

      <h3 className="mt-3 text-xl font-extrabold leading-snug text-slate-900">{d.title}</h3>

      <p className="mt-2 text-lg">
        <span className="font-semibold text-slate-600">Entro: </span>
        <span className="inline-block font-extrabold text-slate-900 first-letter:uppercase">{formatLong(due)}</span>
      </p>
      {shifted && (
        <p className="text-base text-slate-600">
          Data spostata dal {formatShort(d.dueDate)} ({shifted}) al primo giorno lavorativo.
        </p>
      )}

      <dl className="mt-3 grid gap-2 text-lg sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-sm font-semibold text-slate-500">Importo</dt>
          <dd className="font-extrabold text-slate-900">{d.amount ? formatEuro(d.amount) : d.calculator ? "Variabile – usa il calcolatore" : "—"}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-sm font-semibold text-slate-500">Codice Tributo F24</dt>
          <dd className="font-extrabold text-slate-900">{code || "—"}</dd>
        </div>
      </dl>

      {d.portal && (
        <p className="mt-3 flex items-start gap-2 text-base text-slate-700">
          <Globe className="mt-1 h-5 w-5 shrink-0" aria-hidden /> <span><b>Dove:</b> {d.portal}</span>
        </p>
      )}

      {d.specialRule && <p className="mt-3 rounded-xl border-l-4 border-blue-600 bg-blue-50 p-3 text-base text-blue-950">ℹ️ {d.specialRule}</p>}

      {(d.description || d.notes) && (
        <div className="mt-3 text-base text-slate-700">
          {(showMore || !d.description || d.description.length < 160) ? (
            <>
              {d.description && <p>{d.description}</p>}
              {d.notes && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-950">📝 {d.notes}</p>}
            </>
          ) : (
            <p>
              {d.description.slice(0, 150)}…{" "}
              <button className="font-semibold text-blue-700 underline" onClick={() => setShowMore(true)}>Leggi tutto</button>
            </p>
          )}
        </div>
      )}

      {d.calculator && d.status === "todo" && (
        <div className="mt-4 rounded-xl border-2 border-dashed border-slate-300 p-3">
          <label className="label flex items-center gap-2" htmlFor={`calc-${d.id}`}>
            <Calculator className="h-5 w-5" aria-hidden />
            Calcolatore rapido: {d.calculator.type === "percent" ? d.calculator.baseLabel : d.calculator.unitLabel}
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id={`calc-${d.id}`}
              inputMode="decimal"
              className="field max-w-[12rem]"
              placeholder={d.calculator.type === "percent" ? "Es. 1250,00" : "Es. 15"}
              value={base}
              onChange={(e) => setBase(e.target.value)}
            />
            <span className="text-lg text-slate-600">
              {d.calculator.type === "percent" ? `× ${d.calculator.rate}%` : `× ${formatEuro(d.calculator.unitAmount)}`}
              {d.calculator.min ? ` (min. ${formatEuro(d.calculator.min)})` : ""} =
            </span>
            <span className="text-2xl font-extrabold text-slate-900">{formatEuro(calcResult)}</span>
            {calcResult !== null && calcResult > 0 && (
              <button className="btn-ghost !py-2 text-base" onClick={() => onSaveAmount(d, calcResult)}>Usa come importo</button>
            )}
          </div>
        </div>
      )}

      {lastDone && (
        <p className="mt-3 flex items-center gap-2 text-base text-green-800">
          <History className="h-5 w-5 shrink-0" aria-hidden />
          Ultima volta fatto il {new Date(lastDone.completedAt).toLocaleDateString("it-IT")}
          {lastDone.amountPaid ? ` (${formatEuro(lastDone.amountPaid)})` : ""}
          {lastDone.receiptName && <Receipt className="h-5 w-5" aria-label="ricevuta allegata" />}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {d.status === "todo" && d.active && (
          <button className="btn-green flex-1 py-4 text-xl" onClick={() => onComplete(d, calcResult ?? d.amount ?? null)}>
            <CircleCheckBig className="h-7 w-7" aria-hidden /> SEGNA COME PAGATO / FATTO
          </button>
        )}
        <button className="btn-ghost" onClick={() => onEdit(d)}>
          <Pencil className="h-5 w-5" aria-hidden /> Modifica
        </button>
        {lastDone && (
          <button className="btn-ghost" onClick={() => onUndo(d)} title="Annulla l'ultimo completamento">
            <Undo2 className="h-5 w-5" aria-hidden /> Annulla ultimo
          </button>
        )}
      </div>
    </article>
  );
}
