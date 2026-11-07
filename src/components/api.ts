"use client";
import type { Contract, Deadline } from "@/lib/types";

export interface AppData {
  today: string;
  deadlines: Deadline[];
  contracts: Contract[];
  storage: { kind: string; persistent: boolean };
}

export async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
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
