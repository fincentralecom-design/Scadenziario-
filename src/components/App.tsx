"use client";
import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarCheck, FileText, PlusCircle, TriangleAlert } from "lucide-react";
import { api, type AppData } from "./api";
import Dashboard from "./Dashboard";
import DeadlineManager from "./DeadlineManager";
import Contracts from "./Contracts";
import SettingsPanel from "./SettingsPanel";
import type { Deadline } from "@/lib/types";

type Tab = "dashboard" | "edit" | "contracts" | "settings";

const TABS: { id: Tab; label: string; short: string; icon: typeof CalendarCheck }[] = [
  { id: "dashboard", label: "Cruscotto Scadenze", short: "Cruscotto", icon: CalendarCheck },
  { id: "edit", label: "Aggiungi / Modifica", short: "Aggiungi", icon: PlusCircle },
  { id: "contracts", label: "Affitti & Bolli", short: "Affitti", icon: FileText },
  { id: "settings", label: "Alert & Test Invii", short: "Avvisi", icon: BellRing },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<Deadline | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await api<AppData>("/api/deadlines"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (msg: string) => setToast(msg);

  const startEdit = (d: Deadline | null) => {
    setEditing(d);
    setTab("edit");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen pb-28 md:pb-10">
      <header className="bg-blue-800 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <CalendarCheck className="h-9 w-9 shrink-0" aria-hidden />
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">Scadenziario Pro</h1>
            <p className="truncate text-sm text-blue-100 sm:text-base">Affittacamere, P.IVA &amp; Locazioni</p>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-2 px-4 md:flex" aria-label="Sezioni">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-t-xl px-5 py-3 text-lg font-bold ${tab === t.id ? "bg-slate-100 text-blue-900" : "text-blue-50 hover:bg-blue-700"}`}
              aria-current={tab === t.id ? "page" : undefined}
            >
              <t.icon className="h-6 w-6" aria-hidden /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Barra schede in basso su telefono: bottoni grandi */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t-2 border-slate-200 bg-white md:hidden" aria-label="Sezioni">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-1 py-3 text-sm font-bold ${tab === t.id ? "bg-blue-50 text-blue-800" : "text-slate-600"}`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            <t.icon className="h-7 w-7" aria-hidden />
            {t.short}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {data && !data.storage.persistent && (
          <p className="mb-4 flex items-start gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-base text-amber-900">
            <TriangleAlert className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            Archivio temporaneo: i dati possono andare persi. Collega Supabase (vedi README) per salvarli in modo permanente.
          </p>
        )}
        {error && (
          <div className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 p-4 text-lg text-red-900">
            Errore nel caricamento: {error}{" "}
            <button className="underline" onClick={() => void reload()}>Riprova</button>
          </div>
        )}
        {!data && !error && <p className="py-20 text-center text-xl text-slate-500">Caricamento scadenze…</p>}
        {data && tab === "dashboard" && <Dashboard data={data} reload={reload} notify={notify} onEdit={startEdit} />}
        {data && tab === "edit" && (
          <DeadlineManager data={data} reload={reload} notify={notify} editing={editing} setEditing={setEditing} />
        )}
        {data && tab === "contracts" && <Contracts data={data} reload={reload} notify={notify} />}
        {tab === "settings" && <SettingsPanel notify={notify} />}
      </main>

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-2xl bg-slate-900 px-5 py-4 text-center text-lg font-semibold text-white shadow-2xl md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}
