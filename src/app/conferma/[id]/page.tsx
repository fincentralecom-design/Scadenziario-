import { redirect } from "next/navigation";
import { formatLong, formatShort } from "@/lib/dates";
import { effectiveDate, f24CodeFor, formatEuro } from "@/lib/deadlines";
import { completeById, undoById } from "@/lib/service";
import { getStore } from "@/lib/store";
import { verifyDeadlineToken } from "@/lib/token";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conferma scadenza – Scadenziario Anthony Greco", robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; ok?: string; undone?: string }> };

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Pagina aperta dal "Magic Link" ricevuto via Email/WhatsApp/SMS.
 * La conferma avviene solo premendo il bottone (POST): le anteprime automatiche
 * dei link di WhatsApp o dei client email non possono chiudere la scadenza.
 */
export default async function ConfermaPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { t, ok, undone } = await searchParams;
  const d = await getStore().getDeadline(id);

  async function confirm(formData: FormData) {
    "use server";
    const token = String(formData.get("t") || "");
    const cur = await getStore().getDeadline(id);
    if (cur && cur.status === "todo" && verifyDeadlineToken(id, cur.dueDate, token)) {
      const note = String(formData.get("note") || "").slice(0, 500);
      const done = await completeById(id, { via: "magic-link", note: note || "Confermato dal link ricevuto" });
      if (done) {
        await logAudit({
          action: "completata",
          actor: "Link di conferma",
          via: "link",
          target: done.title,
          targetId: id,
          summary: `Confermata dal link ricevuto (scadenza del ${formatShort(done.history[0].dueDate)})${note ? ` · nota: “${note}”` : ""}`,
        });
      }
    }
    redirect(`/conferma/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}&ok=1`);
  }

  async function undo(formData: FormData) {
    "use server";
    const token = String(formData.get("t") || "");
    const cur = await getStore().getDeadline(id);
    const last = cur?.history[0];
    if (cur && last && verifyDeadlineToken(id, last.nominalDueDate, token) && Date.now() - Date.parse(last.completedAt) < UNDO_WINDOW_MS) {
      const d2 = await undoById(id);
      if (d2) await logAudit({ action: "annullata", actor: "Link di conferma", via: "link", target: d2.title, targetId: id, summary: "Conferma annullata dalla pagina del link" });
    }
    redirect(`/conferma/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}&undone=1`);
  }

  if (!d) return <Shell><Box tone="slate" title="Scadenza non trovata">Questa scadenza è stata eliminata o il link non è corretto.</Box></Shell>;

  const pending = d.status === "todo" && verifyDeadlineToken(id, d.dueDate, t);
  const doneEntry = d.history.find((h) => verifyDeadlineToken(id, h.nominalDueDate, t));

  if (pending) {
    const code = f24CodeFor(d);
    return (
      <Shell>
        {undone && <p className="mb-4 rounded-xl bg-amber-100 p-4 text-lg font-semibold text-amber-900">Conferma annullata: la scadenza è di nuovo da fare.</p>}
        <div className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
          <p className="text-lg font-semibold text-slate-600">Scadenza da confermare</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">{d.title}</h1>
          <p className="mt-3 text-xl">
            Entro <b>{formatLong(effectiveDate(d))}</b>
            {d.amount ? <> · <b>{formatEuro(d.amount)}</b></> : null}
          </p>
          <form action={confirm} className="mt-6">
            <input type="hidden" name="t" value={t} />
            <button type="submit" className="w-full rounded-3xl bg-green-700 px-6 py-8 text-3xl font-extrabold text-white shadow-xl hover:bg-green-800 active:scale-[0.98]">
              ✅ HO FATTO
              <span className="mt-1 block text-xl font-bold">CONFERMA PAGAMENTO</span>
            </button>
            <details className="mt-4 text-lg">
              <summary className="cursor-pointer font-semibold text-slate-700">Aggiungi una nota (facoltativo)</summary>
              <textarea name="note" rows={2} className="field mt-2" placeholder="Es. pagato con F24 dalla banca, ricevuta in cartella" />
              <button type="submit" className="btn-green mt-3 w-full">Conferma con nota</button>
            </details>
          </form>
          <dl className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-lg">
            {code && <Row label="Codice F24">{code}</Row>}
            {d.portal && <Row label="Dove">{d.portal}</Row>}
          </dl>
          {d.specialRule && <p className="mt-4 rounded-xl bg-blue-50 p-4 text-base text-blue-900">ℹ️ {d.specialRule}</p>}
        </div>
      </Shell>
    );
  }

  if (doneEntry) {
    const canUndo = d.history[0]?.id === doneEntry.id && Date.now() - Date.parse(doneEntry.completedAt) < UNDO_WINDOW_MS;
    const doneAt = new Date(doneEntry.completedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "full", timeStyle: "short" });
    return (
      <Shell>
        <Box tone="green" title={ok ? "Fatto! Grazie ✅" : "Già confermata ✅"}>
          <p className="font-semibold">{d.title}</p>
          <p className="mt-2">Scadenza del {formatShort(doneEntry.dueDate)} confermata {doneAt}.</p>
          {d.status === "todo" && <p className="mt-2">La prossima scadenza è stata creata per il <b>{formatShort(effectiveDate(d))}</b>.</p>}
        </Box>
        {canUndo && (
          <form action={undo} className="mt-6 text-center">
            <input type="hidden" name="t" value={t} />
            <button type="submit" className="btn-ghost">Ho sbagliato, annulla la conferma</button>
          </form>
        )}
      </Shell>
    );
  }

  return (
    <Shell>
      <Box tone="slate" title="Link non più valido">
        Questo link non corrisponde più alla scadenza attuale. Apri l&apos;app per vedere lo stato aggiornato.
      </Box>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <p className="mb-6 text-center text-lg font-bold text-blue-800">📅 Scadenziario Anthony Greco</p>
      {children}
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-3">
      <dt className="w-32 shrink-0 font-semibold text-slate-500">{label}</dt>
      <dd className="font-bold text-slate-900">{children}</dd>
    </div>
  );
}

function Box({ tone, title, children }: { tone: "green" | "slate"; title: string; children: React.ReactNode }) {
  const cls = tone === "green" ? "bg-green-50 ring-green-300 text-green-950" : "bg-white ring-slate-200 text-slate-800";
  return (
    <div className={`rounded-3xl p-6 text-lg shadow ring-2 ${cls}`}>
      <h1 className="mb-3 text-3xl font-extrabold">{title}</h1>
      {children}
    </div>
  );
}
