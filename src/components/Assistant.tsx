"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Check, Mic, MicOff, Pencil, Send, Sparkles } from "lucide-react";
import { formatLong } from "@/lib/dates";
import { effectiveDate, formatEuro } from "@/lib/deadlines";
import type { DeadlineDraft } from "@/lib/quickParse";
import { CATEGORY_LABELS, RECURRENCE_LABELS } from "@/lib/types";
import { api } from "./api";
import { celebrate, type Notify } from "./feedback";

interface Msg {
  role: "user" | "assistant";
  content: string;
  drafts?: (DeadlineDraft & { saved?: boolean })[];
  mode?: "ai" | "base";
}

// Riconoscimento vocale del browser (Safari/Chrome): tipi minimi.
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type SpeechCtor = new () => SpeechRec;

const EXAMPLES = [
  "Assicurazione della struttura il 20 dicembre, 350 euro, ogni anno",
  "Ricordami la TARI il 16 di ogni mese",
  "Revisione caldaia tra 2 mesi",
];

export default function Assistant({ notify, reload, onUseInForm }: { notify: Notify; reload: () => Promise<void>; onUseInForm: (d: DeadlineDraft) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Ciao! Scrivimi o dimmi a voce cosa devi ricordare, con la data. Preparo io la scadenza." },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState<SpeechCtor | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    setVoice(() => w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs, busy]);

  const send = async (content: string) => {
    const clean = content.trim();
    if (!clean || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: clean }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const history = next.slice(1).map((m) => ({ role: m.role, content: m.content }));
      const r = await api<{ reply: string; deadlines: DeadlineDraft[]; mode: "ai" | "base" }>("/api/assistant", "POST", { messages: history });
      setMsgs([...next, { role: "assistant", content: r.reply, drafts: r.deadlines, mode: r.mode }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: `Si è verificato un problema: ${e instanceof Error ? e.message : e}` }]);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = () => {
    if (!voice) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new voice();
    rec.lang = "it-IT";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setText((finalText + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") notify("Consenti l'uso del microfono nelle impostazioni del telefono.");
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) void send(finalText);
    };
    recRef.current = rec;
    setListening(true);
    try {
      navigator.vibrate?.(30);
    } catch {
      /* ignora */
    }
    rec.start();
  };

  const saveDraft = async (mi: number, di: number) => {
    const d = msgs[mi].drafts![di];
    await api("/api/deadlines", "POST", { ...d, active: true });
    setMsgs((all) => all.map((m, i) => (i === mi ? { ...m, drafts: m.drafts!.map((x, j) => (j === di ? { ...x, saved: true } : x)) } : m)));
    celebrate();
    notify(`✅ Salvata: ${d.title}`);
    await reload();
  };

  const saveAll = async (mi: number) => {
    const list = msgs[mi].drafts!.map((d, i) => ({ d, i })).filter((x) => !x.d.saved);
    for (const { d } of list) await api("/api/deadlines", "POST", { ...d, active: true });
    setMsgs((all) => all.map((m, i) => (i === mi ? { ...m, drafts: m.drafts!.map((x) => ({ ...x, saved: true })) } : m)));
    celebrate();
    notify(`✅ Salvate ${list.length} scadenze`);
    await reload();
  };

  return (
    <section className="mb-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-2 ring-indigo-200">
      <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-700 to-blue-700 px-5 py-4 text-white">
        <Sparkles className="h-7 w-7 shrink-0" aria-hidden />
        <div>
          <h2 className="text-xl font-extrabold">Assistente: scrivi o parla</h2>
          <p className="text-sm text-indigo-100">Descrivi la scadenza con parole tue, la preparo io</p>
        </div>
      </div>

      <div className="max-h-[28rem] space-y-3 overflow-y-auto overscroll-contain bg-slate-50 p-4" aria-live="polite">
        {msgs.map((m, mi) => (
          <div key={mi} className={`card-in flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[92%] ${m.role === "user" ? "rounded-2xl rounded-br-md bg-blue-700 px-4 py-3 text-lg text-white" : ""}`}>
              {m.role === "assistant" ? (
                <>
                  <div className="flex items-start gap-2">
                    <Bot className="mt-1 h-6 w-6 shrink-0 text-indigo-700" aria-hidden />
                    <p className="rounded-2xl rounded-tl-md bg-white px-4 py-3 text-lg text-slate-900 shadow-sm ring-1 ring-slate-200">{m.content}</p>
                  </div>
                  {m.drafts && m.drafts.length > 0 && (
                    <div className="mt-2 space-y-2 pl-8">
                      {m.drafts.map((d, di) => (
                        <div key={di} className={`rounded-xl border-2 p-3 ${d.saved ? "border-green-300 bg-green-50" : "border-indigo-200 bg-white"}`}>
                          <p className="text-lg font-extrabold">{d.title}</p>
                          <p className="text-base text-slate-700">
                            📅 {formatLong(effectiveDate({ dueDate: d.dueDate, shiftIfHoliday: d.shiftIfHoliday }))} · {RECURRENCE_LABELS[d.recurrence]}
                          </p>
                          <p className="text-base text-slate-700">
                            {CATEGORY_LABELS[d.category]}
                            {d.amount ? ` · ${formatEuro(d.amount)}` : ""}
                            {d.f24Code ? ` · F24 ${d.f24Code}` : ""}
                          </p>
                          {d.notes && <p className="text-base text-slate-600">📝 {d.notes}</p>}
                          {d.saved ? (
                            <p className="mt-2 font-bold text-green-800">✅ Salvata</p>
                          ) : (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <button className="btn-green !px-3 !py-2 text-base" onClick={() => void saveDraft(mi, di)}>
                                <Check className="h-5 w-5" aria-hidden /> Salva
                              </button>
                              <button className="btn-ghost !px-3 !py-2 text-base" onClick={() => onUseInForm(d)}>
                                <Pencil className="h-5 w-5" aria-hidden /> Modifica
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {m.drafts.filter((d) => !d.saved).length > 1 && (
                        <button className="btn-green w-full" onClick={() => void saveAll(mi)}>
                          <Check className="h-5 w-5" aria-hidden /> Salva tutte
                        </button>
                      )}
                    </div>
                  )}
                  {m.mode === "base" && mi === msgs.length - 1 && (
                    <p className="mt-1 pl-8 text-sm text-slate-500">Modalità base (AI non collegata): scrivi frasi semplici con la data.</p>
                  )}
                </>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-lg text-slate-500">
            <Bot className="h-6 w-6 text-indigo-700" aria-hidden />
            <span className="inline-flex gap-1">
              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-400" />
              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:.15s]" />
              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:.3s]" />
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {msgs.length === 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => void send(e)} className="shrink-0 rounded-full border-2 border-indigo-200 bg-indigo-50 px-3 py-2 text-base font-semibold text-indigo-900 active:bg-indigo-100">
              {e}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex items-end gap-2 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        {voice && (
          <button
            type="button"
            onClick={toggleMic}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow transition active:scale-90 ${listening ? "animate-pulse bg-red-600" : "bg-indigo-700"}`}
            aria-label={listening ? "Ferma la dettatura" : "Parla"}
          >
            {listening ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
          </button>
        )}
        <textarea
          rows={1}
          className="field min-h-14 flex-1 resize-none"
          placeholder={listening ? "Ti ascolto…" : "Scrivi qui…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          aria-label="Messaggio per l'assistente"
        />
        <button type="submit" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-700 text-white shadow transition active:scale-90 disabled:opacity-40" disabled={busy || !text.trim()} aria-label="Invia">
          <Send className="h-6 w-6" />
        </button>
      </form>
    </section>
  );
}
