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
};
const demo = () => (globalThis as { __scadenziarioDemo?: DemoHooks }).__scadenziarioDemo;

export function receiptUrl(deadlineId: string, historyId: string): string {
  return demo()?.receipt(deadlineId, historyId) ?? `/api/receipts/${encodeURIComponent(deadlineId)}/${historyId}`;
}

export async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const d = demo();
  if (d) return (await d.api(url, method, body)) as T;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Errore ${res.status}`);
  return data as T;
}
