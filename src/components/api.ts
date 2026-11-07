"use client";
import type { Contract, Deadline } from "@/lib/types";

export interface AppData {
  today: string;
  deadlines: Deadline[];
  contracts: Contract[];
  storage: { kind: string; persistent: boolean };
}

/** Nella versione demo (index.html locale) le chiamate sono gestite nel browser. */
type DemoHooks = {
  api: (url: string, method: string, body?: unknown) => Promise<unknown>;
  receipt: (deadlineId: string, historyId: string) => string;
  calendar: (id?: string) => string;
};
const demo = () => (globalThis as { __scadenziarioDemo?: DemoHooks }).__scadenziarioDemo;

export function receiptUrl(deadlineId: string, historyId: string): string {
  return demo()?.receipt(deadlineId, historyId) ?? `/api/receipts/${encodeURIComponent(deadlineId)}/${historyId}`;
}

/** Indirizzo del file .ics con le scadenze (nella demo viene creato nel browser). */
export function calendarUrl(id?: string): string {
  const d = demo();
  if (!d) return id ? `/api/calendar?id=${encodeURIComponent(id)}` : "/api/calendar";
  return URL.createObjectURL(new Blob([d.calendar(id)], { type: "text/calendar" }));
}

/** Scarica il file .ics: su iPhone Safari propone subito "Aggiungi al Calendario". */
export function downloadCalendar(id?: string) {
  const a = document.createElement("a");
  a.href = calendarUrl(id);
  a.download = id ? "scadenza.ics" : "scadenziario-greco.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const isDemo = () => !!demo();

export async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const d = demo();
  if (d) return (await d.api(url, method, body)) as T;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401 && !url.startsWith("/api/login")) {
    location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
    throw new Error("Accesso scaduto");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Errore ${res.status}`);
  return data as T;
}
