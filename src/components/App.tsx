"use client";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, History, MessageCircleQuestion, Settings as SettingsIcon, CalendarCheck, FileText, LogOut, Menu, Plus, PlusCircle, TriangleAlert, X } from "lucide-react";
import { api, type AppData } from "./api";
import Dashboard from "./Dashboard";
import DeadlineManager from "./DeadlineManager";
import Contracts from "./Contracts";
import SettingsPanel, { type SettingsSection } from "./SettingsPanel";
import Guide from "./Guide";
import Splash from "./Splash";
import AskChat from "./AskChat";
import type { Deadline } from "@/lib/types";
import type { Notify, ToastAction } from "./feedback";


type Tab = "dashboard" | "edit" | "contracts" | "settings";

const TABS: { id: Tab; label: string; short: string; icon: typeof CalendarCheck }[] = [
  { id: "dashboard", label: "Cruscotto Scadenze", short: "Cruscotto", icon: CalendarCheck },
  { id: "edit", label: "Aggiungi / Modifica", short: "Aggiungi", icon: PlusCircle },
  { id: "contracts", label: "Affitti & Bolli", short: "Affitti", icon: FileText },
  { id: "settings", label: "Impostazioni", short: "Impostazioni", icon: SettingsIcon },
];

export default function App({ showLogout = true }: { showLogout?: boolean }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; msg: string; action?: ToastAction } | null>(null);
  const [party, setParty] = useState(0);
  const [editing, setEditing] = useState<Deadline | null>(null);
  const [guide, setGuide] = useState(false);
  const [menu, setMenu] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("avvisi");

  const logout = async () => {
    if (!confirm("Vuoi uscire dallo Scadenziario?")) return;
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    location.href = "/login";
  };

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

  // Ricarica i dati quando si torna sull'app (es. dopo aver confermato dal link ricevuto).
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  useEffect(() => {
    const on = () => setParty((p) => p + 1);
    window.addEventListener("sg:celebrate", on);
    return () => window.removeEventListener("sg:celebrate", on);
  }, []);

  useEffect(() => {
    if (!party) return;
    const t = setTimeout(() => setParty(0), 1300);
    return () => clearTimeout(t);
  }, [party]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 7000 : 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const notify: Notify = (msg, action) => setToast({ id: Date.now(), msg, action });

  const goTab = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startEdit = (d: Deadline | null) => {
    setEditing(d);
    setTab("edit");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen pb-28 md:pb-10">
      <header className="safe-top bg-blue-800 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-4 sm:gap-3">
          <CalendarCheck className="hidden h-11 w-11 shrink-0 sm:block" aria-hidden />
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.6rem] font-extrabold leading-[1.1] sm:text-4xl">
              Scadenziario <span className="block text-yellow-300 sm:inline">Anthony Greco</span>
            </h1>
            <p className="text-sm text-blue-200 sm:text-base">By Bruno Greco</p>
          </div>
          <button
            onClick={() => setMenu(true)}
            className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-blue-900 shadow active:scale-95 md:hidden"
            aria-label="Apri il menu"
            aria-expanded={menu}
          >
            <Menu className="h-7 w-7" aria-hidden /> Menu
          </button>
          <button
            onClick={() => setGuide(true)}
            className="hidden shrink-0 flex-col items-center gap-0.5 rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-blue-900 shadow hover:bg-blue-50 md:flex md:flex-row md:gap-2 md:px-4 md:py-2 md:text-lg"
          >
            <BookOpen className="h-6 w-6" aria-hidden /> Guida
          </button>
          {showLogout && (
            <button
              onClick={() => void logout()}
              className="hidden shrink-0 flex-col items-center gap-0.5 rounded-xl border-2 border-white/40 px-2.5 py-1 text-sm font-bold text-white hover:bg-blue-700 md:flex md:flex-row md:gap-2 md:px-3 md:py-2 md:text-lg"
            >
              <LogOut className="h-6 w-6" aria-hidden /> Esci
            </button>
          )}
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-2 px-4 md:flex" aria-label="Sezioni">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => goTab(t.id)}
              className={`flex items-center gap-2 rounded-t-xl px-5 py-3 text-lg font-bold ${tab === t.id ? "bg-slate-100 text-blue-900" : "text-blue-50 hover:bg-blue-700"}`}
              aria-current={tab === t.id ? "page" : undefined}
            >
              <t.icon className="h-6 w-6" aria-hidden /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Barra schede in basso su telefono: bottoni grandi */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t-2 border-slate-200 bg-white/95 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur md:hidden" aria-label="Sezioni">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => goTab(t.id)}
            className={`relative flex min-w-0 flex-col items-center gap-1 whitespace-nowrap py-3 text-[13px] font-bold tracking-tight transition-colors active:bg-slate-100 ${tab === t.id ? "text-blue-800" : "text-slate-600"}`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {tab === t.id && <span className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-blue-700" aria-hidden />}
            <t.icon className={`h-7 w-7 transition-transform ${tab === t.id ? "scale-110" : ""}`} aria-hidden />
            {t.short}
          </button>
        ))}
      </nav>

      <main key={tab} className="fade-in mx-auto max-w-6xl px-4 py-5">
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
        {tab === "settings" && <SettingsPanel notify={notify} section={settingsSection} onSection={setSettingsSection} />}
      </main>

      {/* Menu ad hamburger (telefono) */}
      {menu && (
        <div className="fade-in fixed inset-0 z-[65] bg-black/50 md:hidden" onClick={() => setMenu(false)} role="dialog" aria-modal="true" aria-label="Menu">
          <nav
            className="drawer-in safe-top safe-bottom absolute inset-y-0 right-0 flex w-[85%] max-w-sm flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-blue-800 px-5 py-4 text-white">
              <div>
                <p className="text-xl font-extrabold">Scadenziario Anthony Greco</p>
                <p className="text-sm text-blue-200">By Bruno Greco</p>
              </div>
              <button onClick={() => setMenu(false)} className="rounded-xl bg-white/15 p-2" aria-label="Chiudi il menu">
                <X className="h-7 w-7" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setMenu(false);
                    goTab(t.id);
                  }}
                  className={`flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left text-xl font-bold active:bg-slate-100 ${tab === t.id ? "bg-blue-50 text-blue-800" : "text-slate-800"}`}
                >
                  <t.icon className="h-7 w-7 shrink-0" aria-hidden /> {t.label}
                </button>
              ))}
              <hr className="my-2 border-slate-200" />
              <button
                onClick={() => {
                  setMenu(false);
                  startEdit(null);
                }}
                className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left text-xl font-bold text-slate-800 active:bg-slate-100"
              >
                <Plus className="h-7 w-7 shrink-0" aria-hidden /> Nuova scadenza
              </button>
              <button
                onClick={() => {
                  setMenu(false);
                  setAskOpen(true);
                }}
                className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left text-xl font-bold text-indigo-800 active:bg-slate-100"
              >
                <MessageCircleQuestion className="h-7 w-7 shrink-0" aria-hidden /> Chiedi allo Scadenziario
              </button>
              <button
                onClick={() => {
                  setMenu(false);
                  setSettingsSection("diario");
                  goTab("settings");
                }}
                className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left text-xl font-bold text-slate-800 active:bg-slate-100"
              >
                <History className="h-7 w-7 shrink-0" aria-hidden /> Diario attività
              </button>
              <button
                onClick={() => {
                  setMenu(false);
                  setGuide(true);
                }}
                className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left text-xl font-bold text-slate-800 active:bg-slate-100"
              >
                <BookOpen className="h-7 w-7 shrink-0" aria-hidden /> Guida
              </button>
            </div>
            {showLogout && (
              <button onClick={() => void logout()} className="m-3 flex items-center justify-center gap-3 rounded-2xl border-2 border-red-200 px-4 py-4 text-xl font-bold text-red-700 active:bg-red-50">
                <LogOut className="h-7 w-7" aria-hidden /> Esci
              </button>
            )}
          </nav>
        </div>
      )}

      {guide && <Guide onClose={() => setGuide(false)} />}
      {askOpen && <AskChat onClose={() => setAskOpen(false)} />}

      <Splash />

      {/* Pulsante "Chiedi" (assistente che legge tutti i dati) */}
      {tab === "dashboard" && data && (
        <button
          onClick={() => setAskOpen(true)}
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-4 z-30 flex h-16 items-center gap-2 rounded-full bg-gradient-to-r from-indigo-700 to-blue-700 px-5 text-lg font-bold text-white shadow-xl transition active:scale-95 md:bottom-8 md:left-auto md:right-8"
          aria-label="Chiedi allo Scadenziario"
        >
          <MessageCircleQuestion className="h-8 w-8" aria-hidden /> Chiedi
        </button>
      )}

      {/* Pulsante rapido "+" sul telefono */}
      {tab === "dashboard" && data && (
        <button
          onClick={() => startEdit(null)}
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-blue-700 text-white shadow-xl transition active:scale-90 md:hidden"
          aria-label="Aggiungi scadenza"
        >
          <Plus className="h-9 w-9" aria-hidden />
        </button>
      )}

      {party > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center" aria-hidden>
          <div className="check-pop flex h-40 w-40 items-center justify-center rounded-full bg-green-600 shadow-2xl">
            <svg viewBox="0 0 24 24" className="h-24 w-24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
        </div>
      )}

      {toast && (
        <div
          key={toast.id}
          role="status"
          className="toast-in fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-5 py-4 text-lg font-semibold text-white shadow-2xl md:bottom-8"
        >
          <span className="flex-1">{toast.msg}</span>
          {toast.action && (
            <button
              className="shrink-0 rounded-xl bg-white/15 px-4 py-2 font-bold text-yellow-300 active:bg-white/25"
              onClick={() => {
                const a = toast.action!;
                setToast(null);
                void a.run();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button className="shrink-0 px-1 text-2xl leading-none text-white/60" onClick={() => setToast(null)} aria-label="Chiudi">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
