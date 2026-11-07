"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Mic, MicOff, Send, Sparkles, X } from "lucide-react";
import { api } from "./api";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
}
type SpeechCtor = new () => SpeechRec;

const SUGGESTIONS = [
  "Cosa scade questa settimana?",
  "Quanto devo pagare nei prossimi 30 giorni?",
  "Quando ho pagato l'ultima volta l'IMU?",
  "Ci sono scadenze superate?",
  "Chi ha modificato qualcosa negli ultimi giorni?",
];

/** Chat "Chiedi allo Scadenziario": legge tutti i dati e risponde. */
export default function AskChat({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"ai" | "base" | null>(null);
  const [voice, setVoice] = useState<SpeechCtor | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    setVoice(() => w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null);
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const ask = async (q: string) => {
    const clean = q.trim();
    if (!clean || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: clean }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const r = await api<{ answer: string; mode: "ai" | "base" }>("/api/ask", "POST", { messages: next });
      setMode(r.mode);
      setMsgs([...next, { role: "assistant", content: r.answer }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: `Si è verificato un problema: ${e instanceof Error ? e.message : e}` }]);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = () => {
    if (!voice) return;
    if (listening) return recRef.current?.stop();
    const rec = new voice();
    rec.lang = "it-IT";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setText((finalText + interim).trim());
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) void ask(finalText);
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div className="fade-in fixed inset-0 z-[66] flex justify-center bg-black/50 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="ask-title">
      <div className="sheet-in flex h-full w-full max-w-2xl flex-col bg-slate-50 sm:rounded-3xl">
        <div className="safe-top flex items-center gap-3 bg-gradient-to-r from-indigo-700 to-blue-700 px-4 py-4 text-white sm:rounded-t-3xl">
          <Sparkles className="h-8 w-8 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="ask-title" className="text-xl font-extrabold">Chiedi allo Scadenziario</h2>
            <p className="text-sm text-indigo-100">Leggo scadenze, pagamenti, contratti e diario</p>
          </div>
          <button onClick={onClose} className="flex items-center gap-1 rounded-xl bg-white/15 px-3 py-2 text-lg font-bold" aria-label="Chiudi">
            <X className="h-6 w-6" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" aria-live="polite">
          <div className="flex items-start gap-2">
            <Bot className="mt-1 h-7 w-7 shrink-0 text-indigo-700" aria-hidden />
            <p className="rounded-2xl rounded-tl-md bg-white px-4 py-3 text-lg shadow-sm ring-1 ring-slate-200">
              Ciao! Fammi una domanda su scadenze, pagamenti fatti, contratti o modifiche. Puoi anche parlare col microfono 🎤
            </p>
          </div>
          {msgs.length === 0 && (
            <div className="space-y-2 pl-9">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => void ask(s)} className="block w-full rounded-2xl border-2 border-indigo-200 bg-white px-4 py-3 text-left text-lg font-semibold text-indigo-900 active:bg-indigo-50">
                  {s}
                </button>
              ))}
            </div>
          )}
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="card-in flex justify-end">
                <p className="max-w-[88%] rounded-2xl rounded-br-md bg-blue-700 px-4 py-3 text-lg text-white">{m.content}</p>
              </div>
            ) : (
              <div key={i} className="card-in flex items-start gap-2">
                <Bot className="mt-1 h-7 w-7 shrink-0 text-indigo-700" aria-hidden />
                <p className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-tl-md bg-white px-4 py-3 text-lg leading-relaxed text-slate-900 shadow-sm ring-1 ring-slate-200 [overflow-wrap:anywhere]">
                  {m.content}
                </p>
              </div>
            ),
          )}
          {busy && (
            <div className="flex items-center gap-2 pl-1">
              <Bot className="h-7 w-7 text-indigo-700" aria-hidden />
              <span className="inline-flex gap-1">
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-400" />
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:.15s]" />
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:.3s]" />
              </span>
            </div>
          )}
          {mode === "base" && <p className="pl-9 text-sm text-slate-500">Modalità base: per risposte complete serve la chiave AI sul sito.</p>}
          <div ref={endRef} />
        </div>

        <form
          className="safe-bottom flex items-end gap-2 border-t border-slate-200 bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(text);
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
                void ask(text);
              }
            }}
            aria-label="Domanda"
          />
          <button type="submit" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-700 text-white shadow transition active:scale-90 disabled:opacity-40" disabled={busy || !text.trim()} aria-label="Invia domanda">
            <Send className="h-6 w-6" />
          </button>
        </form>
      </div>
    </div>
  );
}
