// Magic link firmati: il token lega id + data della scadenza, così un link vecchio
// non può chiudere per errore l'occorrenza successiva di una scadenza ricorrente.
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  return process.env.MAGIC_LINK_SECRET || process.env.CRON_SECRET || process.env.BUILD_SECRET || "dev-only-insecure-secret-change-me";
}

export function signDeadline(id: string, nominalDueDate: string): string {
  return createHmac("sha256", secret()).update(`${id}:${nominalDueDate}`).digest("base64url").slice(0, 32);
}

export function verifyDeadlineToken(id: string, nominalDueDate: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const expected = Buffer.from(signDeadline(id, nominalDueDate));
  const got = Buffer.from(token);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export function baseUrl(settingsUrl?: string): string {
  const url =
    settingsUrl ||
    process.env.APP_URL ||
    process.env.URL || // Netlify: indirizzo principale del sito
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

export function magicLink(id: string, nominalDueDate: string, settingsUrl?: string): string {
  return `${baseUrl(settingsUrl)}/conferma/${encodeURIComponent(id)}?t=${signDeadline(id, nominalDueDate)}`;
}

/** Token per il calendario in abbonamento (il Calendario dell'iPhone non può fare login). */
export function calendarToken(): string {
  return createHmac("sha256", secret()).update("calendar-feed:v1").digest("base64url").slice(0, 32);
}
