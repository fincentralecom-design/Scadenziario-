import { promises as fs } from "node:fs";
import path from "node:path";
import type { Contract, Deadline } from "../types";
import type { Store } from "./types";

interface DB {
  deadlines: Record<string, Deadline>;
  contracts: Record<string, Contract>;
  kv: Record<string, unknown>;
}

/** Archivio su file JSON: ideale in locale, su un server/VPS o in Docker con volume. */
export class JsonStore implements Store {
  kind = "json" as const;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private file: string, public persistent = true) {}

  private async read(): Promise<DB> {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      const db = JSON.parse(raw) as Partial<DB>;
      return { deadlines: db.deadlines ?? {}, contracts: db.contracts ?? {}, kv: db.kv ?? {} };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return { deadlines: {}, contracts: {}, kv: {} };
      throw e;
    }
  }

  private async write(db: DB): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, this.file);
  }

  /** Serializza le scritture per evitare sovrascritture concorrenti. */
  private mutate(fn: (db: DB) => void): Promise<void> {
    const run = this.queue.then(async () => {
      const db = await this.read();
      fn(db);
      await this.write(db);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async listDeadlines() {
    await this.queue;
    return Object.values((await this.read()).deadlines);
  }
  async getDeadline(id: string) {
    await this.queue;
    return (await this.read()).deadlines[id] ?? null;
  }
  upsertDeadlines(list: Deadline[]) {
    return this.mutate((db) => list.forEach((d) => (db.deadlines[d.id] = d)));
  }
  deleteDeadlines(ids: string[]) {
    return this.mutate((db) => ids.forEach((id) => delete db.deadlines[id]));
  }
  async listContracts() {
    await this.queue;
    return Object.values((await this.read()).contracts);
  }
  async getContract(id: string) {
    await this.queue;
    return (await this.read()).contracts[id] ?? null;
  }
  upsertContract(c: Contract) {
    return this.mutate((db) => void (db.contracts[c.id] = c));
  }
  deleteContract(id: string) {
    return this.mutate((db) => void delete db.contracts[id]);
  }
  async getKV<T>(key: string) {
    await this.queue;
    return ((await this.read()).kv[key] as T) ?? null;
  }
  setKV<T>(key: string, value: T) {
    return this.mutate((db) => void (db.kv[key] = value));
  }
}
