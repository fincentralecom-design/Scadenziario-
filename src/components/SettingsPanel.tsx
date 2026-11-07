"use client";
import { useEffect, useState } from "react";
import { CircleCheck, CircleX, Mail, MessageCircle, PlayCircle, Save, Send, Smartphone } from "lucide-react";
import { todayRome } from "@/lib/dates";
import type { Settings } from "@/lib/types";
import { api } from "./api";

interface SettingsResponse {
  settings: Settings;
  providers: { email: string | null; sms: string | null; whatsapp: string | null };
  effectiveUrl: string;
  cronProtected: boolean;
  magicSecretSet: boolean;
  runs: { at: string; today: string; alerts: number; sent: number }[];
}

interface Msg {
  deadlineId: string;
  subject: string;
  emailHtml: string;
  whatsapp: string;
  sms: string;
  link: string;
  kind: string;
  alreadySent: boolean;
}

interface TestResponse {
  date: string;
  isSample: boolean;
  messages: Msg[];
  sent?: { subject: string; results: { channel: string; ok: boolean; skipped?: boolean; detail: string; provider?: string }[] }[];
}

/** Rende *grassetto* in stile WhatsApp. */
function WaText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((p, i) =>
        p.startsWith("*") && p.endsWith("*") ? <b key={i}>{p.slice(1, -1)}</b> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export default function SettingsPanel({ notify }: { notify: (m: string) => void }) {
  const [info, setInfo] = useState<SettingsResponse | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [date, setDate] = useState(todayRome());
  const [test, setTest] = useState<TestResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const r = await api<SettingsResponse>("/api/settings");
    setInfo(r);
    setS(r.settings);
  };
  useEffect(() => {
    void load().catch((e) => notify(`Errore: ${e.message}`));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s || !info) return <p className="py-20 text-center text-xl text-slate-500">Caricamento impostazioni…</p>;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy("save");
    try {
      await api("/api/settings", "PUT", s);
      notify("💾 Impostazioni salvate");
      await load();
    } catch (err) {
      notify(`Errore: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(null);
    }
  };

  const runTest = async (action: "preview" | "send") => {
    if (action === "send" && !confirm("Inviare ADESSO i messaggi di prova ai recapiti salvati?")) return;
    setBusy(action);
    try {
      if (action === "send") await api("/api/settings", "PUT", s);
      const r = await api<TestResponse>("/api/alerts/test", "POST", { action, date });
      setTest(r);
      if (action === "send") notify("📤 Invio di prova eseguito: controlla l'esito qui sotto");
    } catch (err) {
      notify(`Errore: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(null);
    }
  };

  const channels: { key: keyof Settings["channels"]; label: string; icon: typeof Mail; field: "email" | "whatsapp" | "sms"; placeholder: string; type: string; provider: string | null }[] = [
    { key: "email", label: "Email destinatario", icon: Mail, field: "email", placeholder: "nome@esempio.it", type: "email", provider: info.providers.email },
    { key: "whatsapp", label: "Numero WhatsApp", icon: MessageCircle, field: "whatsapp", placeholder: "+39 333 1234567", type: "tel", provider: info.providers.whatsapp },
    { key: "sms", label: "Numero SMS", icon: Smartphone, field: "sms", placeholder: "+39 333 1234567", type: "tel", provider: info.providers.sms },
  ];

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-1 text-2xl font-extrabold">Chi riceve gli avvisi</h2>
        <p className="mb-4 text-base text-slate-600">
          Ogni mattina alle 08:30 l&apos;app controlla le scadenze e avvisa <b>3 giorni prima</b> e <b>il giorno stesso</b>.
        </p>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="s-name">Nome destinatario</label>
            <input id="s-name" className="field" value={s.recipientName} onChange={(e) => set("recipientName", e.target.value)} placeholder="Es. Papà" />
          </div>
          {channels.map((c) => (
            <div key={c.key} className="rounded-xl border-2 border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="label !mb-0 flex items-center gap-2" htmlFor={`s-${c.key}`}>
                  <c.icon className="h-6 w-6" aria-hidden /> {c.label}
                </label>
                <label className="flex items-center gap-2 text-lg font-semibold">
                  <input type="checkbox" className="h-6 w-6" checked={s.channels[c.key]} onChange={(e) => set("channels", { ...s.channels, [c.key]: e.target.checked })} />
                  Attivo
                </label>
              </div>
              <input id={`s-${c.key}`} type={c.type} className="field mt-2" value={s[c.field]} onChange={(e) => set(c.field, e.target.value)} placeholder={c.placeholder} />
              <p className={`mt-2 flex items-center gap-2 text-base ${c.provider ? "text-green-800" : "text-amber-800"}`}>
                {c.provider ? <CircleCheck className="h-5 w-5" aria-hidden /> : <CircleX className="h-5 w-5" aria-hidden />}
                {c.provider ? `Servizio di invio collegato: ${c.provider}` : "Servizio di invio non ancora configurato (vedi README)"}
              </p>
            </div>
          ))}
          <label className="flex items-start gap-3 text-lg">
            <input type="checkbox" className="mt-1 h-6 w-6" checked={s.overdueReminder} onChange={(e) => set("overdueReminder", e.target.checked)} />
            <span>Sollecito giornaliero se una scadenza è superata e non ancora confermata</span>
          </label>
          <div>
            <label className="label" htmlFor="s-url">Indirizzo pubblico dell&apos;app (per i link di conferma)</label>
            <input id="s-url" className="field" value={s.appUrl} onChange={(e) => set("appUrl", e.target.value)} placeholder={info.effectiveUrl} />
            <p className="mt-1 text-base text-slate-500">In uso: {info.effectiveUrl}</p>
          </div>
        </div>
        <button type="submit" className="btn-green mt-5 w-full py-4 text-xl" disabled={busy === "save"}>
          <Save className="h-6 w-6" aria-hidden /> Salva impostazioni
        </button>
        {!info.magicSecretSet && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-base text-amber-900">
            ⚠️ Imposta la variabile MAGIC_LINK_SECRET (o CRON_SECRET) sul server per firmare in modo sicuro i link di conferma.
          </p>
        )}
      </form>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-1 text-2xl font-extrabold">Test degli avvisi</h2>
        <p className="mb-4 text-base text-slate-600">
          Guarda in anteprima i messaggi che partirebbero. Puoi simulare un altro giorno per vedere cosa arriverebbe.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="label" htmlFor="t-date">Simula come se oggi fosse</label>
            <input id="t-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <button className="btn-blue flex-1 py-4" onClick={() => void runTest("preview")} disabled={!!busy}>
            <PlayCircle className="h-6 w-6" aria-hidden /> Simula Controllo Giornaliero (Test Alert)
          </button>
        </div>

        {test && (
          <div className="mt-6">
            <p className="mb-3 text-lg font-semibold">
              {test.isSample
                ? `Nessun avviso previsto per il ${new Date(`${test.date}T12:00:00`).toLocaleDateString("it-IT")}. Ecco un esempio con la prossima scadenza:`
                : `Avvisi previsti per il ${new Date(`${test.date}T12:00:00`).toLocaleDateString("it-IT")}: ${test.messages.length}`}
            </p>
            {test.messages.length === 0 && <p className="text-lg text-slate-600">Nessuna scadenza attiva.</p>}
            <div className="space-y-6">
              {test.messages.map((m) => (
                <div key={m.deadlineId + m.kind} className="rounded-2xl border-2 border-slate-200 p-4">
                  <p className="text-lg font-extrabold [overflow-wrap:anywhere]">{m.subject}</p>
                  {m.alreadySent && <p className="text-base text-green-800">Già inviato oggi dal controllo automatico.</p>}
                  <div className="mt-3 grid gap-4 xl:grid-cols-3 [&>div]:min-w-0">
                    <div>
                      <p className="label flex items-center gap-2"><Mail className="h-5 w-5" aria-hidden /> Email</p>
                      <iframe title={`Anteprima email ${m.subject}`} srcDoc={m.emailHtml} className="h-[28rem] w-full rounded-xl border border-slate-200 bg-white" sandbox="" />
                    </div>
                    <div>
                      <p className="label flex items-center gap-2"><MessageCircle className="h-5 w-5" aria-hidden /> WhatsApp</p>
                      <div className="rounded-xl bg-[#e5ddd5] p-3">
                        <div className="whitespace-pre-wrap [overflow-wrap:anywhere] rounded-xl rounded-tl-none bg-[#dcf8c6] p-3 text-base shadow">
                          <WaText text={m.whatsapp} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="label flex items-center gap-2"><Smartphone className="h-5 w-5" aria-hidden /> SMS ({m.sms.length} caratteri)</p>
                      <div className="rounded-xl bg-slate-100 p-3">
                        <div className="whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl bg-white p-3 text-base shadow">{m.sms}</div>
                      </div>
                    </div>
                  </div>
                  <a href={m.link} target="_blank" rel="noreferrer" className="mt-3 inline-block text-base font-semibold text-blue-700 underline">
                    Apri il link di conferma (Magic Link)
                  </a>
                </div>
              ))}
            </div>
            {test.messages.length > 0 && (
              <button className="btn-green mt-5 w-full py-4 text-xl" onClick={() => void runTest("send")} disabled={!!busy}>
                <Send className="h-6 w-6" aria-hidden /> {busy === "send" ? "Invio in corso…" : "Invia subito questi messaggi di prova"}
              </button>
            )}
            {test.sent && (
              <div className="mt-4 space-y-3">
                {test.sent.map((r) => (
                  <div key={r.subject} className="rounded-xl bg-slate-50 p-3">
                    <p className="font-bold">{r.subject}</p>
                    <ul className="mt-1 space-y-1 text-base">
                      {r.results.length === 0 && <li>Nessun canale attivo.</li>}
                      {r.results.map((x) => (
                        <li key={x.channel} className={x.ok ? "text-green-800" : x.skipped ? "text-amber-800" : "text-red-700"}>
                          {x.ok ? "✅" : x.skipped ? "⚠️" : "❌"} {x.channel.toUpperCase()}
                          {x.provider ? ` (${x.provider})` : ""}: {x.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-2 text-2xl font-extrabold">Controllo automatico giornaliero</h2>
        <p className="text-base text-slate-700">
          Indirizzo chiamato ogni mattina: <code className="break-all rounded bg-slate-100 px-1">{info.effectiveUrl}/api/cron/check-deadlines</code>
          {info.cronProtected ? " (protetto da CRON_SECRET)" : " – ⚠️ imposta CRON_SECRET per proteggerlo"}
        </p>
        <h3 className="mt-4 text-lg font-bold">Ultimi controlli eseguiti</h3>
        {info.runs.length === 0 ? (
          <p className="text-base text-slate-600">Nessun controllo automatico ancora eseguito.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-base">
            {info.runs.slice(0, 7).map((r) => (
              <li key={r.at}>
                {new Date(r.at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })} – avvisi trovati: {r.alerts}, inviati: {r.sent}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
