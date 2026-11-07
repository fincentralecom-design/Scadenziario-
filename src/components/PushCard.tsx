"use client";
import { useEffect, useState } from "react";
import { BellRing, CalendarPlus, Share, SquarePlus } from "lucide-react";
import { api, downloadCalendar, isDemo } from "./api";
import type { Notify } from "./feedback";

type State = "loading" | "demo" | "unsupported" | "install" | "denied" | "off" | "on";

function base64ToUint8(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Attivazione notifiche push su questo dispositivo + esportazione Calendario. */
export default function PushCard({ notify }: { notify: Notify }) {
  const [state, setState] = useState<State>("loading");
  const [devices, setDevices] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState<{ https: string; webcal: string } | null>(null);

  useEffect(() => {
    if (!isDemo()) void api<{ https: string; webcal: string }>("/api/calendar/link").then(setFeed).catch(() => undefined);
  }, []);

  const refresh = async () => {
    if (isDemo()) return setState("demo");
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return setState(isIOS() && !isStandalone() ? "install" : "unsupported");
    try {
      const info = await api<{ devices: number }>("/api/push");
      setDevices(info.devices);
    } catch {
      /* ignora */
    }
    if (Notification.permission === "denied") return setState("denied");
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setState(sub ? "on" : "off");
  };

  useEffect(() => {
    void refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await api<{ publicKey: string }>("/api/push");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8(publicKey) });
      const device = `${isIOS() ? "iPhone/iPad" : navigator.platform || "Dispositivo"} – ${new Date().toLocaleDateString("it-IT")}`;
      const r = await api<{ devices: number }>("/api/push", "POST", { subscription: sub.toJSON(), device });
      setDevices(r.devices);
      setState("on");
      notify("🔔 Notifiche attivate su questo dispositivo");
    } catch (e) {
      notify(`Errore: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/api/push", "DELETE", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
      notify("Notifiche disattivate su questo dispositivo");
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; detail: string }>("/api/push/test", "POST");
      notify(r.ok ? "📨 Notifica di prova inviata: controlla il telefono" : `Non inviata: ${r.detail}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-1 flex items-center gap-2 text-2xl font-extrabold">
        <BellRing className="h-7 w-7" aria-hidden /> Notifiche sul telefono
      </h2>
      <p className="mb-4 text-base text-slate-600">
        Ricevi gli avvisi come notifica, come quelle di WhatsApp. Gratis, senza servizi esterni.
      </p>

      {state === "loading" && <p className="text-lg text-slate-500">Controllo in corso…</p>}

      {state === "demo" && (
        <p className="rounded-xl bg-amber-50 p-4 text-lg text-amber-900">Disponibili solo nell&apos;app pubblicata online, non nella versione di prova.</p>
      )}

      {state === "install" && (
        <div className="rounded-xl bg-blue-50 p-4 text-lg text-blue-950">
          <p className="font-bold">Sull&apos;iPhone serve prima aggiungere l&apos;app alla schermata Home:</p>
          <ol className="mt-2 list-decimal space-y-2 pl-6">
            <li>
              Apri questo sito con <b>Safari</b> e tocca <Share className="inline h-5 w-5" aria-label="Condividi" /> <b>Condividi</b> (in basso).
            </li>
            <li>
              Scegli <SquarePlus className="inline h-5 w-5" aria-hidden /> <b>Aggiungi alla schermata Home</b>, poi <b>Aggiungi</b>.
            </li>
            <li>Apri lo Scadenziario dall&apos;icona sulla Home, entra e torna qui: comparirà il pulsante per attivare le notifiche.</li>
          </ol>
          <p className="mt-2 text-base">Serve iOS 16.4 o successivo.</p>
        </div>
      )}

      {state === "unsupported" && (
        <p className="rounded-xl bg-amber-50 p-4 text-lg text-amber-900">Questo browser non supporta le notifiche. Usa Safari su iPhone o Chrome su Android/computer.</p>
      )}

      {state === "denied" && (
        <p className="rounded-xl bg-amber-50 p-4 text-lg text-amber-900">
          Le notifiche sono bloccate. Su iPhone: <b>Impostazioni → Notifiche → Scadenziario</b> e attiva “Consenti notifiche”, poi riapri l&apos;app.
        </p>
      )}

      {state === "off" && (
        <button className="btn-green w-full py-4 text-xl" onClick={() => void enable()} disabled={busy}>
          <BellRing className="h-6 w-6" aria-hidden /> {busy ? "Attivazione…" : "Attiva notifiche su questo telefono"}
        </button>
      )}

      {state === "on" && (
        <div className="space-y-3">
          <p className="rounded-xl bg-green-50 p-4 text-lg font-semibold text-green-900">✅ Notifiche attive su questo dispositivo.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn-blue" onClick={() => void test()} disabled={busy}>Invia notifica di prova</button>
            <button className="btn-ghost" onClick={() => void disable()} disabled={busy}>Disattiva su questo telefono</button>
          </div>
        </div>
      )}

      {state !== "demo" && state !== "loading" && (
        <p className="mt-3 text-base text-slate-500">Dispositivi iscritti: {devices}. Puoi attivarle su più telefoni (es. tuo e di papà).</p>
      )}

      <hr className="my-5 border-slate-200" />
      <h3 className="flex items-center gap-2 text-xl font-extrabold">
        <CalendarPlus className="h-6 w-6" aria-hidden /> Aggiungi al Calendario
      </h3>
      <p className="mt-1 text-base text-slate-600">
        Le scadenze compaiono nel Calendario dell&apos;iPhone con promemoria <b>3 giorni prima</b> e <b>il giorno stesso alle 8:30</b>:
        l&apos;iPhone suona anche senza internet.
      </p>
      {feed && (
        <div className="mt-3 rounded-xl bg-green-50 p-4">
          <p className="text-lg font-bold text-green-950">Consigliato: calendario che si aggiorna da solo</p>
          <a className="btn-green mt-2 w-full" href={feed.webcal}>
            <CalendarPlus className="h-6 w-6" aria-hidden /> Abbonati nel Calendario iPhone
          </a>
          <p className="mt-2 text-base text-green-950">
            Tocca <b>Abbonati</b> e poi <b>Aggiungi</b>. Importante: nella schermata di aggiunta disattiva
            <b> “Rimuovi avvisi”</b> (o “Rimuovi promemoria”), altrimenti l&apos;iPhone non suona.
          </p>
          <button
            className="mt-2 text-base font-semibold text-green-900 underline"
            onClick={() => void navigator.clipboard?.writeText(feed.https).then(() => notify("Link copiato"))}
          >
            Copia link (per Google Calendar / Outlook)
          </button>
        </div>
      )}
      <button className="btn-ghost mt-3 w-full" onClick={() => downloadCalendar()}>
        <CalendarPlus className="h-6 w-6" aria-hidden /> Scarica tutte le scadenze (.ics)
      </button>
      <p className="mt-1 text-base text-slate-500">Su ogni scheda trovi anche il pulsante “Aggiungi al Calendario” per una singola scadenza.</p>
    </section>
  );
}
