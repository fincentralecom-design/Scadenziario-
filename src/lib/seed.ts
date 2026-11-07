// Scadenze precaricate al primo avvio (modificabili/disattivabili dall'interfaccia).
import { addDays, makeDate, parseDate } from "./dates";
import { rollForward } from "./deadlines";
import type { Calculator, Category, Deadline, Recurrence } from "./types";

interface SeedDef {
  key: string;
  title: string;
  category: Category;
  recurrence: Recurrence;
  /** Mese 1-12 (assente per le mensili). */
  month?: number;
  day: number;
  /** 31 = ultimo giorno del mese (es. 28/29 febbraio). */
  anchorDay?: number;
  f24Code?: string;
  f24Auto?: "iva_mensile";
  portal?: string;
  description?: string;
  notes?: string;
  specialRule?: string;
  calculator?: Calculator;
  shift?: boolean;
  /** Per le scadenze tecniche senza data fissa: giorni da oggi. */
  offsetDays?: number;
}

const BOLLO_CALC: Calculator = { type: "perUnit", unitAmount: 2, unitLabel: "Numero fatture con bollo (importo > 77,47 € senza IVA)" };

export const SEED_DEFS: SeedDef[] = [
  // ---------------- A) MENSILI ----------------
  {
    key: "istat-flussi",
    title: "Flussi Turistici ISTAT (Ross1000 / Osservatorio Turistico)",
    category: "mensile",
    recurrence: "mensile",
    day: 5,
    portal: "Ross1000 / Portale turistico regionale",
    description: "Trasmissione telematica degli arrivi e delle presenze del mese precedente sul portale turistico regionale.",
    notes: "Inserire anche i mesi a zero presenze o comunicare la chiusura della struttura.",
    shift: false,
  },
  {
    key: "ota-td17",
    title: "Emissione Autofatture OTA (Tipo Documento TD17)",
    category: "mensile",
    recurrence: "mensile",
    day: 15,
    portal: "Sistema di Interscambio (SdI) – Fatture e Corrispettivi o gestionale",
    description:
      "Invio allo SdI dell'integrazione/autofattura in reverse charge per le fatture di commissione emesse il mese precedente da portali esteri (Booking.com, Airbnb, Expedia).",
    notes: "Tipo documento TD17 – Natura N6.9 non applicabile: si integra con IVA 22%. Indicare come cedente il portale estero.",
  },
  {
    key: "ota-iva-f24",
    title: "Versamento IVA su Autofatture OTA (Modello F24)",
    category: "mensile",
    recurrence: "mensile",
    day: 16,
    f24Auto: "iva_mensile",
    portal: "F24 (home banking / Agenzia Entrate)",
    description:
      "Versamento dell'IVA al 22% calcolata sulle commissioni estere del mese precedente tramite F24 (Codici Tributo da 6001 a 6012 in base al mese di competenza).",
    calculator: { type: "percent", rate: 22, baseLabel: "Commissioni OTA estere del mese (€)" },
  },
  {
    key: "piva-mensile",
    title: "Adempimenti Mensili P.IVA (IVA / Ritenute d'acconto)",
    category: "mensile",
    recurrence: "mensile",
    day: 16,
    f24Code: "1040 (ritenute professionisti) – 6001…6012 (IVA mensile)",
    portal: "F24 (home banking / Agenzia Entrate)",
    description:
      "Eventuale versamento IVA mensile e ritenute d'acconto operate su fatture di professionisti pagate nel mese precedente (Codice Tributo F24: 1040).",
    calculator: { type: "percent", rate: 20, baseLabel: "Compensi lordi pagati a professionisti (€) – ritenuta 20%" },
  },

  // ---------------- B) TRIMESTRALI ----------------
  {
    key: "bollo-q1",
    title: "Imposta di Bollo su Fatture Elettroniche - 1° Trimestre (Gen-Mar)",
    category: "trimestrale",
    recurrence: "annuale",
    month: 5,
    day: 31,
    f24Code: "2521",
    portal: "F24 o addebito da Fatture e Corrispettivi",
    description: "Versamento del bollo virtuale (2 €) sulle fatture elettroniche del 1° trimestre.",
    specialRule: "Se l'importo dovuto per il 1° trimestre non supera 5.000 €, il pagamento può slittare al 30 Settembre.",
    calculator: BOLLO_CALC,
  },
  {
    key: "bollo-q2",
    title: "Imposta di Bollo su Fatture Elettroniche - 2° Trimestre (Apr-Giu)",
    category: "trimestrale",
    recurrence: "annuale",
    month: 9,
    day: 30,
    f24Code: "2522",
    portal: "F24 o addebito da Fatture e Corrispettivi",
    description: "Versamento del bollo virtuale (2 €) sulle fatture elettroniche del 2° trimestre.",
    specialRule: "Se la somma del bollo di 1° e 2° trimestre non supera 5.000 €, il pagamento può slittare al 30 Novembre.",
    calculator: BOLLO_CALC,
  },
  {
    key: "bollo-q3",
    title: "Imposta di Bollo su Fatture Elettroniche - 3° Trimestre (Lug-Set)",
    category: "trimestrale",
    recurrence: "annuale",
    month: 11,
    day: 30,
    f24Code: "2523",
    portal: "F24 o addebito da Fatture e Corrispettivi",
    description: "Versamento del bollo virtuale (2 €) sulle fatture elettroniche del 3° trimestre.",
    calculator: BOLLO_CALC,
  },
  {
    key: "bollo-q4",
    title: "Imposta di Bollo su Fatture Elettroniche - 4° Trimestre (Ott-Dic)",
    category: "trimestrale",
    recurrence: "annuale",
    month: 2,
    day: 28,
    anchorDay: 31,
    f24Code: "2524",
    portal: "F24 o addebito da Fatture e Corrispettivi",
    description: "Versamento del bollo virtuale (2 €) sulle fatture elettroniche del 4° trimestre dell'anno precedente (fine febbraio).",
    calculator: BOLLO_CALC,
  },
  ...([
    ["q1", "1° Trimestre (Gen-Mar)", 4],
    ["q2", "2° Trimestre (Apr-Giu)", 7],
    ["q3", "3° Trimestre (Lug-Set)", 10],
    ["q4", "4° Trimestre (Ott-Dic)", 1],
  ] as const).map(
    ([q, label, month]): SeedDef => ({
      key: `soggiorno-${q}`,
      title: `Dichiarazione e Riversamento Trimestrale Imposta di Soggiorno al Comune - ${label}`,
      category: "trimestrale",
      recurrence: "annuale",
      month,
      day: 15,
      portal: "Portale comunale imposta di soggiorno – PagoPA / Bonifico / F24",
      description: "Comunicazione presenze ed esenzioni sul portale comunale e versamento somme incassate tramite PagoPA/Bonifico/F24.",
      notes: "Data modificabile in base al regolamento del proprio Comune.",
    }),
  ),
  ...([
    ["1", 5, 16, "1° rata (gen-mar)"],
    ["2", 8, 20, "2° rata (apr-giu)"],
    ["3", 11, 16, "3° rata (lug-set)"],
    ["4", 2, 16, "4° rata (ott-dic)"],
  ] as const).map(
    ([n, month, day, label]): SeedDef => ({
      key: `inps-fissi-${n}`,
      title: `Contributi INPS Fissi – ${label}`,
      category: "trimestrale",
      recurrence: "annuale",
      month,
      day,
      f24Code: "Sezione INPS – causale AF (artigiani) / CF (commercianti)",
      portal: "F24 (modello precompilato nel Cassetto previdenziale INPS)",
      description: "Versamento della rata trimestrale dei contributi fissi sul minimale (Gestione Artigiani e Commercianti).",
    }),
  ),
  ...([
    ["1", 5, 31, undefined, "1° trimestre"],
    ["2", 9, 30, undefined, "2° trimestre"],
    ["3", 11, 30, undefined, "3° trimestre"],
    ["4", 2, 28, 31, "4° trimestre"],
  ] as const).map(
    ([n, month, day, anchorDay, label]): SeedDef => ({
      key: `lipe-${n}`,
      title: `Liquidazioni Periodiche IVA (LIPE) – ${label}`,
      category: "trimestrale",
      recurrence: "annuale",
      month,
      day,
      anchorDay,
      portal: "Agenzia Entrate – Fatture e Corrispettivi / Entratel",
      description: "Comunicazione delle liquidazioni periodiche IVA (solo regime ordinario o semplificato, non forfettario).",
      notes: "Se sei in regime forfettario puoi disattivare questa scadenza.",
    }),
  ),

  // ---------------- C) ANNUALI ----------------
  {
    key: "modello-21",
    title: "Modello 21 - Conto della Gestione Imposta di Soggiorno",
    category: "annuale",
    recurrence: "annuale",
    month: 1,
    day: 30,
    portal: "Portale comunale / PEC al Comune",
    description: "Trasmissione obbligatoria al Comune del rendiconto annuale come Agente Contabile per l'anno solare precedente.",
  },
  {
    key: "rai-speciale",
    title: "Rinnovo Canone RAI Speciale Strutture Ricettive",
    category: "annuale",
    recurrence: "annuale",
    month: 1,
    day: 31,
    portal: "Bollettino / F24 – abbonamenti.rai.it",
    description: "Rinnovo annuale dell'abbonamento speciale RAI per gli apparecchi presenti nella struttura ricettiva.",
  },
  {
    key: "cu",
    title: "Certificazione Unica (CU) e Verifica Ritenute 21% Portali",
    category: "annuale",
    recurrence: "annuale",
    month: 3,
    day: 16,
    portal: "Agenzia Entrate – Entratel / Fisconline",
    description: "Invio CU per compensi a professionisti e raccolta CU rilasciate da portali OTA per ritenute 21%.",
  },
  {
    key: "imu-acconto",
    title: "Acconto IMU e Scadenze TARI",
    category: "annuale",
    recurrence: "annuale",
    month: 6,
    day: 16,
    f24Code: "3918 (IMU altri fabbricati – Comune)",
    portal: "F24 / Avviso TARI del Comune (PagoPA)",
    description: "Versamento del 50% dell'IMU annua e verifica rate TARI previste dal Comune.",
  },
  {
    key: "soggiorno-ade",
    title: "Dichiarazione Annuale Imposta di Soggiorno (Agenzia delle Entrate)",
    category: "annuale",
    recurrence: "annuale",
    month: 6,
    day: 30,
    portal: "Agenzia Entrate – Fisconline / Entratel",
    description: "Invio telematico sul portale dell'Agenzia delle Entrate della dichiarazione cumulativa dell'anno precedente.",
  },
  {
    key: "saldo-acconto",
    title: "Saldo e 1° Acconto Imposte (IRPEF / Sostitutiva), INPS e Diritto Camerale",
    category: "annuale",
    recurrence: "annuale",
    month: 6,
    day: 30,
    f24Code: "Saldo 4001 / 1792 – 1° acconto 4033 / 1790 – Diritto camerale 3850",
    portal: "F24 (home banking / Agenzia Entrate)",
    description:
      "Versamento F24 Saldo (Cod. 1792 o 4001), 1° Acconto (Cod. 1790 o 4033), contributi INPS e Diritto Annuale Camera di Commercio (Cod. 3850).",
    specialRule: "Prorogabile al 30 Luglio con maggiorazione dello 0,40%.",
  },
  {
    key: "redditi-770",
    title: "Invio Modello Redditi PF e Modello 770",
    category: "annuale",
    recurrence: "annuale",
    month: 10,
    day: 31,
    portal: "Agenzia Entrate – Entratel / Fisconline (o commercialista)",
    description: "Trasmissione telematica della dichiarazione dei redditi e del modello 770 (sostituti d'imposta).",
  },
  {
    key: "secondo-acconto",
    title: "2° Acconto Imposte sui Redditi e INPS",
    category: "annuale",
    recurrence: "annuale",
    month: 11,
    day: 30,
    f24Code: "4034 (IRPEF) / 1791 (sostitutiva forfettario)",
    portal: "F24 (home banking / Agenzia Entrate)",
    description: "Versamento del secondo acconto delle imposte sui redditi e dei contributi INPS a percentuale.",
  },
  {
    key: "imu-saldo",
    title: "Saldo IMU Annuale",
    category: "annuale",
    recurrence: "annuale",
    month: 12,
    day: 16,
    f24Code: "3918 (IMU altri fabbricati – Comune)",
    portal: "F24 (home banking / Agenzia Entrate)",
    description: "Versamento del saldo IMU con eventuale conguaglio sulle aliquote deliberate dal Comune.",
  },

  // ---------------- E) SICUREZZA E STRUTTURA ----------------
  {
    key: "estintori",
    title: "Revisione Semestrale Estintori",
    category: "sicurezza",
    recurrence: "semestrale",
    day: 0,
    offsetDays: 30,
    shift: false,
    portal: "Ditta manutentrice antincendio",
    description: "Controllo periodico semestrale degli estintori secondo la Norma UNI 9994-1, con annotazione sul cartellino e sul registro antincendio.",
    notes: "⚠️ Data indicativa: modificala con la data reale dell'ultimo controllo + 6 mesi.",
  },
  {
    key: "caldaia",
    title: "Controllo Annuale Caldaia, Fumi, Filtri Clima e Rilevatori Gas/Monossido",
    category: "sicurezza",
    recurrence: "annuale",
    day: 0,
    offsetDays: 60,
    shift: false,
    portal: "Tecnico manutentore / Libretto d'impianto (CURIT o catasto regionale)",
    description: "Manutenzione caldaia con analisi fumi, pulizia filtri climatizzatori e verifica rilevatori gas e monossido di carbonio (richiesti per il CIN).",
    notes: "⚠️ Data indicativa: modificala con la data reale.",
  },
  {
    key: "alloggiati",
    title: "Rinnovo Certificato Digitale Alloggiati Web Questura",
    category: "sicurezza",
    recurrence: "una_tantum",
    day: 0,
    offsetDays: 90,
    shift: false,
    portal: "alloggiatiweb.poliziadistato.it",
    description: "Rinnovo del certificato digitale per l'invio delle schedine alloggiati alla Questura.",
    notes: "⚠️ Inserisci la data di scadenza indicata nel portale Alloggiati Web.",
  },
];

function firstDate(def: SeedDef, today: string): string {
  if (def.offsetDays !== undefined) return addDays(today, def.offsetDays);
  const t = parseDate(today);
  const y = t.getUTCFullYear();
  const m = def.month ?? t.getUTCMonth() + 1;
  const day = def.anchorDay ?? def.day;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return makeDate(y, m, Math.min(day, dim));
}

/** Genera le scadenze di partenza, ciascuna alla prima occorrenza futura. */
export function buildSeed(today: string): Deadline[] {
  const now = new Date().toISOString();
  return SEED_DEFS.map((def) => {
    const base: Deadline = {
      id: `seed_${def.key}`,
      seedKey: def.key,
      title: def.title,
      category: def.category,
      dueDate: firstDate(def, today),
      anchorDay: def.anchorDay ?? (def.offsetDays === undefined ? def.day : undefined),
      recurrence: def.recurrence,
      f24Code: def.f24Code,
      f24Auto: def.f24Auto,
      portal: def.portal,
      description: def.description,
      notes: def.notes,
      specialRule: def.specialRule,
      calculator: def.calculator,
      amount: null,
      shiftIfHoliday: def.shift ?? true,
      active: true,
      status: "todo",
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    return rollForward(base, today);
  });
}
