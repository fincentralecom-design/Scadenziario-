import path from "node:path";
import { JsonStore } from "./json";
import { NetlifyBlobsStore } from "./netlify";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

let store: Store | null = null;

/** Sceglie l'archivio: Supabase se configurato, poi Netlify Blobs su Netlify, altrimenti file JSON locale. */
export function getStore(): Store {
  if (store) return store;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    store = new SupabaseStore(url, key);
  } else if (process.env.STORAGE_DRIVER === "netlify-blobs" || process.env.NETLIFY_BLOBS_CONTEXT) {
    // Su Netlify i dati vanno in Netlify Blobs: persistenti, senza database esterno.
    store = new NetlifyBlobsStore();
  } else if (process.env.VERCEL && !process.env.DATA_FILE) {
    // Su Vercel il disco è in sola lettura: /tmp funziona ma si azzera. Serve Supabase.
    store = new JsonStore("/tmp/scadenziario-db.json", false);
  } else {
    store = new JsonStore(process.env.DATA_FILE || path.join(process.cwd(), "data", "db.json"));
  }
  return store;
}

export type { Store };
