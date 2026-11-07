import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Contract, Deadline } from "../types";
import type { Store } from "./types";

/**
 * Archivio su Supabase (PostgreSQL). Le tabelle salvano il documento in una colonna JSONB:
 * aggiungere campi in futuro non richiede migrazioni. Schema in supabase/schema.sql.
 */
export class SupabaseStore implements Store {
  kind = "supabase" as const;
  persistent = true;
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  private check<T>(res: { data: T; error: { message: string } | null }): T {
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
    return res.data;
  }

  async listDeadlines() {
    const rows = this.check(await this.db.from("deadlines").select("data"));
    return (rows ?? []).map((r: { data: Deadline }) => r.data);
  }
  async getDeadline(id: string) {
    const row = this.check(await this.db.from("deadlines").select("data").eq("id", id).maybeSingle());
    return (row as { data: Deadline } | null)?.data ?? null;
  }
  async upsertDeadlines(list: Deadline[]) {
    if (!list.length) return;
    this.check(await this.db.from("deadlines").upsert(list.map((d) => ({ id: d.id, data: d, updated_at: new Date().toISOString() }))));
  }
  async deleteDeadlines(ids: string[]) {
    if (!ids.length) return;
    this.check(await this.db.from("deadlines").delete().in("id", ids));
  }
  async listContracts() {
    const rows = this.check(await this.db.from("contracts").select("data"));
    return (rows ?? []).map((r: { data: Contract }) => r.data);
  }
  async getContract(id: string) {
    const row = this.check(await this.db.from("contracts").select("data").eq("id", id).maybeSingle());
    return (row as { data: Contract } | null)?.data ?? null;
  }
  async upsertContract(c: Contract) {
    this.check(await this.db.from("contracts").upsert({ id: c.id, data: c, updated_at: new Date().toISOString() }));
  }
  async deleteContract(id: string) {
    this.check(await this.db.from("contracts").delete().eq("id", id));
  }
  async getKV<T>(key: string) {
    const row = this.check(await this.db.from("kv").select("value").eq("key", key).maybeSingle());
    return ((row as { value: T } | null)?.value ?? null) as T | null;
  }
  async setKV<T>(key: string, value: T) {
    this.check(await this.db.from("kv").upsert({ key, value, updated_at: new Date().toISOString() }));
  }
}
