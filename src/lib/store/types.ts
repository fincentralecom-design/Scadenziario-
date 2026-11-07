import type { Contract, Deadline, Settings } from "../types";

/** Interfaccia unica di persistenza: file JSON locale oppure Supabase. */
export interface Store {
  kind: "json" | "supabase" | "netlify-blobs";
  /** false se i dati possono andare persi al riavvio (es. /tmp su Vercel). */
  persistent: boolean;
  listDeadlines(): Promise<Deadline[]>;
  getDeadline(id: string): Promise<Deadline | null>;
  upsertDeadlines(list: Deadline[]): Promise<void>;
  deleteDeadlines(ids: string[]): Promise<void>;
  listContracts(): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | null>;
  upsertContract(c: Contract): Promise<void>;
  deleteContract(id: string): Promise<void>;
  getKV<T>(key: string): Promise<T | null>;
  setKV<T>(key: string, value: T): Promise<void>;
}
