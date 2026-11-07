import { getStore } from "@netlify/blobs";
import { JsonStore, type DB } from "./json";

const KEY = "db";

/**
 * Archivio su Netlify Blobs: lo stesso documento JSON del file locale,
 * salvato nello spazio dati persistente del sito Netlify (nessuna configurazione).
 */
export class NetlifyBlobsStore extends JsonStore {
  kind = "netlify-blobs" as const;

  constructor() {
    super(KEY, true);
  }

  private blobs() {
    return getStore({ name: "scadenziario", consistency: "strong" });
  }

  protected async read(): Promise<DB> {
    const db = (await this.blobs().get(KEY, { type: "json" })) as Partial<DB> | null;
    return { deadlines: db?.deadlines ?? {}, contracts: db?.contracts ?? {}, kv: db?.kv ?? {} };
  }

  protected async write(db: DB): Promise<void> {
    await this.blobs().setJSON(KEY, db);
  }
}
