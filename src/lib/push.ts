// Notifiche push (anche su iPhone con l'app aggiunta alla schermata Home, iOS 16.4+).
// Le chiavi VAPID si generano da sole al primo uso e restano salvate nell'archivio del sito.
import "server-only";
import { generateVAPIDKeys, sendNotification, WebPushError, type PushSubscription } from "web-push";
import type { AlertMessage } from "./alerts";
import type { SendResult } from "./notify";
import { getStore } from "./store";

const VAPID_KEY = "vapid_keys";
const SUBS_KEY = "push_subscriptions";

export interface StoredSubscription extends PushSubscription {
  createdAt: string;
  device?: string;
}

export async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const store = getStore();
  const saved = await store.getKV<{ publicKey: string; privateKey: string }>(VAPID_KEY);
  if (saved) return saved;
  const keys = generateVAPIDKeys();
  await store.setKV(VAPID_KEY, keys);
  return keys;
}

export async function listSubscriptions(): Promise<StoredSubscription[]> {
  return (await getStore().getKV<StoredSubscription[]>(SUBS_KEY)) ?? [];
}

export async function addSubscription(sub: PushSubscription, device?: string): Promise<number> {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error("Iscrizione non valida");
  if (!/^https:\/\//.test(sub.endpoint)) throw new Error("Indirizzo push non valido");
  const list = (await listSubscriptions()).filter((s) => s.endpoint !== sub.endpoint);
  list.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, createdAt: new Date().toISOString(), device: device?.slice(0, 120) });
  await getStore().setKV(SUBS_KEY, list.slice(-20));
  return list.length;
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const list = (await listSubscriptions()).filter((s) => s.endpoint !== endpoint);
  await getStore().setKV(SUBS_KEY, list);
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** Invia a tutti i dispositivi iscritti; rimuove quelli non più validi. */
export async function sendPushToAll(payload: PushPayload): Promise<SendResult> {
  const subs = await listSubscriptions();
  if (!subs.length) return { channel: "push", ok: false, skipped: true, detail: "Nessun dispositivo iscritto alle notifiche" };
  const { publicKey, privateKey } = await vapidKeys();
  const subject = process.env.VAPID_SUBJECT || "mailto:avvisi@scadenziario.local";
  let ok = 0;
  const dead: string[] = [];
  const errors: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sendNotification(s, JSON.stringify(payload), { vapidDetails: { subject, publicKey, privateKey }, TTL: 60 * 60 * 24 });
        ok++;
      } catch (e) {
        if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) dead.push(s.endpoint);
        else errors.push(e instanceof Error ? e.message : String(e));
      }
    }),
  );
  if (dead.length) {
    const keep = (await listSubscriptions()).filter((s) => !dead.includes(s.endpoint));
    await getStore().setKV(SUBS_KEY, keep);
  }
  return {
    channel: "push",
    provider: "Web Push",
    ok: ok > 0,
    detail: ok > 0 ? `Inviata a ${ok} dispositiv${ok === 1 ? "o" : "i"}` : errors[0] || "Nessun dispositivo raggiungibile",
  };
}

export function pushPayloadFor(msg: AlertMessage): PushPayload {
  const lines = msg.emailText.split("\n").filter((l) => /^(📅|💶|🧾)/.test(l));
  return { title: msg.subject, body: `${lines.join("\n")}\nTocca per confermare.`, url: msg.link, tag: msg.key };
}
