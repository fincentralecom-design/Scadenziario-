// Tipi condivisi tra interfaccia, API e motore di allerta.

export type Recurrence = "una_tantum" | "mensile" | "trimestrale" | "semestrale" | "annuale";

export type Category = "mensile" | "trimestrale" | "annuale" | "locazione" | "sicurezza" | "altro";

/** Calcolatore rapido per importi variabili mostrato sulla scheda. */
export type Calculator =
  | { type: "percent"; rate: number; baseLabel: string; min?: number }
  | { type: "perUnit"; unitAmount: number; unitLabel: string; min?: number };

export interface HistoryEntry {
  id: string;
  /** Data utile (già spostata per festivi) della scadenza completata. */
  dueDate: string;
  /** Data nominale originale, usata per "Annulla" e per riconoscere i magic link già usati. */
  nominalDueDate: string;
  completedAt: string; // ISO
  note?: string;
  amountPaid?: number | null;
  receiptName?: string;
  /** Ricevuta allegata come data URL (limite ~2 MB). */
  receiptData?: string;
  /** Presente nelle risposte API al posto di receiptData (scaricabile a parte). */
  hasReceipt?: boolean;
  via: "app" | "magic-link";
}

export interface Deadline {
  id: string;
  title: string;
  category: Category;
  /** Data nominale YYYY-MM-DD (prima dello spostamento per festivi). */
  dueDate: string;
  /** Giorno "àncora" per le ricorrenze (31 = fine mese). */
  anchorDay?: number;
  recurrence: Recurrence;
  /** Oltre questa data la ricorrenza non viene più rigenerata. */
  endDate?: string;
  amount?: number | null;
  calculator?: Calculator;
  f24Code?: string;
  /** Codice tributo calcolato automaticamente in base al mese. */
  f24Auto?: "iva_mensile";
  portal?: string;
  description?: string;
  notes?: string;
  specialRule?: string;
  /** Se true, sabato/domenica/festivi spostano la scadenza al primo giorno lavorativo. */
  shiftIfHoliday: boolean;
  active: boolean;
  status: "todo" | "done";
  contractId?: string;
  seedKey?: string;
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  tenant: string;
  property: string;
  startDate: string;
  annualRent: number;
  cedolare: boolean;
  /** Durata del primo periodo (4 per 4+4, 3 per 3+2). */
  initialYears: number;
  /** Durata del rinnovo (4 per 4+4, 2 per 3+2). */
  renewalYears: number;
  /** Numero di facciate del contratto (per il bollo). */
  facciate: number;
  /** Copie soggette a bollo. */
  copie: number;
  alreadyRegistered: boolean;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  recipientName: string;
  email: string;
  whatsapp: string;
  sms: string;
  channels: { email: boolean; whatsapp: boolean; sms: boolean };
  /** Sollecito giornaliero per scadenze superate e non confermate. */
  overdueReminder: boolean;
  /** URL pubblico dell'app, usato nei magic link. */
  appUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  recipientName: "Papà",
  email: "",
  whatsapp: "",
  sms: "",
  channels: { email: true, whatsapp: true, sms: true },
  overdueReminder: false,
  appUrl: "",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  mensile: "Mensili",
  trimestrale: "Trimestrali",
  annuale: "Annuali",
  locazione: "Affitti & Locazioni",
  sicurezza: "Sicurezza & Struttura",
  altro: "Personalizzate",
};

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  una_tantum: "Una tantum",
  mensile: "Mensile",
  trimestrale: "Trimestrale",
  semestrale: "Semestrale",
  annuale: "Annuale",
};
