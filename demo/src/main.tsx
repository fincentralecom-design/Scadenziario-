// Versione locale di prova: tutta l'app in un solo index.html, senza server.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "@/components/App";
import { formatLong, formatShort } from "@/lib/dates";
import { effectiveDate, f24CodeFor, formatEuro } from "@/lib/deadlines";
import { completeLocal, installMockApi, load, resetDemo, undoLocal } from "./mockApi";

installMockApi();

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

/** Simulazione della pagina /conferma/[id] aperta dal link ricevuto. */
function Conferma({ id, due }: { id: string; due: string }) {
  const [, force] = useState(0);
  const d = load().deadlines[id];
  const back = () => (location.hash = "");
  const shell = (body: React.ReactNode) => (
    <main className="mx-auto max-w-xl px-4 py-8">
      <p className="mb-6 text-center text-lg font-bold text-blue-800">📅 Scadenziario Anthony Greco</p>
      {body}
      <button className="btn-ghost mt-6 w-full" onClick={back}>Torna all&apos;app</button>
    </main>
  );
  if (!d) return shell(<p className="rounded-3xl bg-white p-6 text-xl">Scadenza non trovata.</p>);
  const done = d.history.find((h) => h.nominalDueDate === due);
  if (d.status === "todo" && d.dueDate === due) {
    const code = f24CodeFor(d);
    return shell(
      <div className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
        <p className="text-lg font-semibold text-slate-600">Scadenza da confermare</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{d.title}</h1>
        <p className="mt-3 text-xl">
          Entro <b>{formatLong(effectiveDate(d))}</b>
          {d.amount ? <> · <b>{formatEuro(d.amount)}</b></> : null}
        </p>
        <button
          className="mt-6 w-full rounded-3xl bg-green-700 px-6 py-8 text-3xl font-extrabold text-white shadow-xl hover:bg-green-800 active:scale-[0.98]"
          onClick={() => {
            completeLocal(id, { via: "magic-link", note: "Confermato dal link ricevuto" });
            force((x) => x + 1);
          }}
        >
          ✅ HO FATTO
          <span className="mt-1 block text-xl font-bold">CONFERMA PAGAMENTO</span>
        </button>
        <dl className="mt-6 space-y-2 border-t border-slate-200 pt-5 text-lg">
          {code && <p><b>Codice F24:</b> {code}</p>}
          {d.portal && <p><b>Dove:</b> {d.portal}</p>}
        </dl>
      </div>,
    );
  }
  if (done) {
    return shell(
      <div className="rounded-3xl bg-green-50 p-6 text-lg shadow ring-2 ring-green-300">
        <h1 className="mb-3 text-3xl font-extrabold">Fatto! Grazie ✅</h1>
        <p className="font-semibold">{d.title}</p>
        <p className="mt-2">Scadenza del {formatShort(done.dueDate)} confermata.</p>
        {d.status === "todo" && <p className="mt-2">Prossima scadenza creata per il <b>{formatShort(effectiveDate(d))}</b>.</p>}
        {d.history[0]?.id === done.id && (
          <button className="btn-ghost mt-4" onClick={() => { undoLocal(id); force((x) => x + 1); }}>
            Ho sbagliato, annulla la conferma
          </button>
        )}
      </div>,
    );
  }
  return shell(<p className="rounded-3xl bg-white p-6 text-xl">Questo link non corrisponde più alla scadenza attuale.</p>);
}

function Root() {
  const hash = useHash();
  const m = hash.match(/^#conferma\/([^/]+)\/(\d{4}-\d{2}-\d{2})$/);
  if (m) return <Conferma id={decodeURIComponent(m[1])} due={m[2]} />;
  return (
    <>
      <div className="bg-amber-100 px-4 py-2 text-center text-base text-amber-950">
        Versione di prova locale: i dati restano in questo browser e gli avvisi sono solo simulati.{" "}
        <button
          className="font-semibold underline"
          onClick={() => {
            if (confirm("Cancellare tutti i dati di prova e ricominciare?")) {
              resetDemo();
              location.reload();
            }
          }}
        >
          Ricomincia da zero
        </button>
      </div>
      <App showLogout={false} />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
