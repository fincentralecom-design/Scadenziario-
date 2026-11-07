"use client";
import { useState } from "react";
import { CircleCheckBig, Paperclip, X } from "lucide-react";
import { todayRome, formatLong } from "@/lib/dates";
import { effectiveDate, nextNominalDate } from "@/lib/deadlines";
import type { Deadline } from "@/lib/types";

const MAX_FILE = 2 * 1024 * 1024;

interface Props {
  d: Deadline;
  suggestedAmount: number | null;
  onClose: () => void;
  onConfirm: (input: { completedAt: string; amountPaid: number | null; note: string; receiptName?: string; receiptData?: string }) => Promise<void>;
}

/** Finestra di conferma: data di esecuzione, importo pagato, nota e ricevuta F24. */
export default function CompleteDialog({ d, suggestedAmount, onClose, onConfirm }: Props) {
  const [date, setDate] = useState(todayRome());
  const [amount, setAmount] = useState(suggestedAmount ? String(suggestedAmount).replace(".", ",") : "");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = nextNominalDate(d);
  const nextOk = next && (!d.endDate || next <= d.endDate);

  const pickFile = (f: File | undefined) => {
    setFileError(null);
    if (!f) return setFile(null);
    if (f.size > MAX_FILE) return setFileError("File troppo grande (massimo 2 MB).");
    const reader = new FileReader();
    reader.onload = () => setFile({ name: f.name, data: String(reader.result) });
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const num = Number(amount.replace(/\./g, "").replace(",", "."));
      await onConfirm({
        completedAt: new Date(`${date}T12:00:00`).toISOString(),
        amountPaid: amount && !Number.isNaN(num) ? num : null,
        note,
        receiptName: file?.name,
        receiptData: file?.data,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="complete-title">
      <div className="sheet-in max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="complete-title" className="text-2xl font-extrabold text-slate-900">Conferma pagamento / adempimento</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100" aria-label="Chiudi">
            <X className="h-7 w-7" />
          </button>
        </div>
        <p className="mt-2 text-lg font-semibold text-slate-700">{d.title}</p>
        <p className="text-base text-slate-500">Scade: {formatLong(effectiveDate(d))}</p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="cd-date">Fatto il giorno</label>
            <input id="cd-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="cd-amount">Importo pagato (€) – facoltativo</label>
            <input id="cd-amount" inputMode="decimal" className="field" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Es. 275,00" />
          </div>
          <div>
            <label className="label" htmlFor="cd-note">Nota / estremi ricevuta F24 – facoltativo</label>
            <textarea id="cd-note" rows={2} className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. F24 pagato con home banking, protocollo n. ..." />
          </div>
          <div>
            <label className="label" htmlFor="cd-file">Allega ricevuta (foto o PDF, max 2 MB)</label>
            <label className="btn-ghost w-full cursor-pointer">
              <Paperclip className="h-5 w-5" aria-hidden /> {file ? file.name : "Scegli file"}
              <input id="cd-file" type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>
            {fileError && <p className="mt-1 text-base font-semibold text-red-700">{fileError}</p>}
          </div>
        </div>

        <p className="mt-5 rounded-xl bg-blue-50 p-3 text-base text-blue-950">
          {nextOk
            ? `Verrà creata in automatico la prossima scadenza: ${formatLong(effectiveDate({ ...d, dueDate: next! }))}.`
            : "Scadenza non ricorrente: verrà archiviata come completata."}
        </p>

        <div className="sticky -bottom-6 -mx-6 mt-5 flex flex-col gap-3 border-t border-slate-200 bg-white px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
          <button className="btn-green py-4 text-xl" onClick={submit} disabled={busy}>
            <CircleCheckBig className="h-7 w-7" aria-hidden /> {busy ? "Salvataggio…" : "CONFERMA: FATTO"}
          </button>
          <button className="btn-ghost" onClick={onClose}>Annulla</button>
        </div>
      </div>
    </div>
  );
}
