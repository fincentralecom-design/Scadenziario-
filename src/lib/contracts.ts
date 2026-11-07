// Generatore automatico delle scadenze collegate ai contratti di locazione (Modello RLI).
import { addDays, addMonths, addYears, formatShort } from "./dates";
import type { Contract, Deadline } from "./types";

export const REGISTRO_RATE = 0.02;
export const REGISTRO_MIN = 67;
export const BOLLO_PER_4_FACCIATE = 16;

/** Imposta di registro annua: 2% del canone annuo, minimo 67 €. */
export function registroAnnuo(annualRent: number): number {
  return Math.round(Math.max(annualRent * REGISTRO_RATE, REGISTRO_MIN) * 100) / 100;
}

/** Imposta di bollo: 16 € ogni 4 facciate (100 righe) per ciascuna copia. */
export function bolloContratto(facciate: number, copie: number): number {
  return Math.ceil(Math.max(facciate, 1) / 4) * BOLLO_PER_4_FACCIATE * Math.max(copie, 1);
}

/** Fine del periodo contrattuale in corso (primo periodo, poi rinnovi) alla data indicata. */
export function currentPeriodEnd(c: Contract, today: string): { end: string; periodIndex: number } {
  let end = addYears(c.startDate, c.initialYears);
  let periodIndex = 0;
  let guard = 0;
  // Scorre i rinnovi finché la scadenza RLI della proroga (fine + 30 gg) non è nel futuro.
  while (addDays(end, 30) < today && guard++ < 50) {
    end = addYears(end, c.renewalYears || c.initialYears);
    periodIndex++;
  }
  return { end, periodIndex };
}

/** Prossimo anniversario annuo (escluso il primo anno) la cui scadenza (+30 gg) è >= oggi, entro il periodo. */
function nextAnniversary(c: Contract, today: string, periodEnd: string): string | null {
  for (let k = 1; k < 200; k++) {
    const ann = addYears(c.startDate, k);
    if (ann >= periodEnd) return null;
    if (addDays(ann, 30) >= today) return ann;
  }
  return null;
}

function base(c: Contract, key: string, now: string): Pick<Deadline, "id" | "contractId" | "category" | "active" | "status" | "history" | "createdAt" | "updatedAt" | "amount"> {
  return {
    id: `ctr_${c.id}_${key}`,
    contractId: c.id,
    category: "locazione",
    active: c.active,
    status: "todo",
    history: [],
    createdAt: now,
    updatedAt: now,
    amount: null,
  };
}

/** Calcola tutte le scadenze collegate a un contratto. */
export function generateContractDeadlines(c: Contract, today: string): Deadline[] {
  const now = new Date().toISOString();
  const label = `${c.tenant} – ${c.property}`;
  const out: Deadline[] = [];
  const registro = registroAnnuo(c.annualRent);
  const { end, periodIndex } = currentPeriodEnd(c, today);

  // 1) Registrazione nuovo contratto (RLI) entro 30 giorni dalla stipula/decorrenza.
  if (!c.alreadyRegistered) {
    const bollo = bolloContratto(c.facciate, c.copie);
    out.push({
      ...base(c, "rli", now),
      title: `Bollo e Registrazione Nuovo Contratto (Modello RLI) – ${label}`,
      dueDate: addDays(c.startDate, 30),
      recurrence: "una_tantum",
      amount: c.cedolare ? 0 : registro + bollo,
      f24Code: c.cedolare ? "Nessuna imposta (cedolare secca)" : "1500 (registro 1ª annualità) + 1505 (bollo) – F24 Elide",
      portal: "Agenzia Entrate – Modello RLI (Fisconline/Entratel)",
      description: c.cedolare
        ? "Registrazione telematica del contratto con Modello RLI e opzione per la cedolare secca: nessuna imposta di registro né di bollo da versare."
        : `Registrazione del contratto con Modello RLI entro 30 giorni dalla decorrenza (${formatShort(c.startDate)}). Imposta di registro 2% del canone annuo (min. 67 €) = ${eur(registro)}; imposta di bollo 16 € ogni 4 facciate/100 righe = ${eur(bollo)}.`,
      notes: "Il bollo è calcolato su facciate e copie indicate nel contratto: verifica con il tuo CAF/commercialista.",
      shiftIfHoliday: true,
    });
  }

  // 2) Annualità successive (solo senza cedolare secca), ogni anno entro 30 gg dall'anniversario.
  if (!c.cedolare) {
    const ann = nextAnniversary(c, today, end);
    if (ann) {
      const lastAnn = addYears(end, -1);
      out.push({
        ...base(c, "annualita", now),
        title: `Pagamento Imposta di Registro Annualità Successive (2%) – ${label}`,
        dueDate: addDays(ann, 30),
        recurrence: "annuale",
        endDate: addDays(lastAnn, 30),
        amount: registro,
        calculator: { type: "percent", rate: 2, baseLabel: "Canone annuo (€)", min: REGISTRO_MIN },
        f24Code: "1501 – F24 Elide",
        portal: "F24 Elide (home banking / Agenzia Entrate)",
        description: `Versamento entro 30 giorni dall'anniversario del contratto. Calcolo automatico: 2% di ${eur(c.annualRent)} (minimo 67 €) = ${eur(registro)}.`,
        notes: "Nel modello F24 Elide indicare il codice identificativo del contratto (serie e numero di registrazione).",
        shiftIfHoliday: true,
      });
    }
  }

  // 3) Proroga contratto entro 30 giorni dalla fine del periodo contrattuale.
  const periodLabel = periodIndex === 0 ? `${c.initialYears}° anno` : "fine rinnovo";
  out.push({
    ...base(c, "proroga", now),
    title: `Proroga Contratto (${periodLabel}) – ${label}`,
    dueDate: addDays(end, 30),
    recurrence: "una_tantum",
    amount: c.cedolare ? 0 : registro,
    f24Code: c.cedolare ? "Nessuna imposta (cedolare secca) – comunicazione RLI" : "1504 – F24 Elide",
    portal: "Agenzia Entrate – Modello RLI (adempimento successivo: proroga)",
    description: `Il periodo contrattuale termina il ${formatShort(end)}. Entro 30 giorni comunicare la proroga con Modello RLI${c.cedolare ? " (in cedolare secca nessuna imposta)" : ` e versare l'imposta di registro (${eur(registro)})`}.`,
    shiftIfHoliday: true,
  });

  // 3b) Preavviso disdetta a 6 mesi dalla fine del periodo.
  out.push({
    ...base(c, "disdetta", now),
    title: `Termine preavviso disdetta (6 mesi) – ${label}`,
    dueDate: addMonths(end, -6),
    recurrence: "una_tantum",
    portal: "Raccomandata A/R o PEC all'inquilino",
    description: `Ultimo giorno utile per inviare l'eventuale disdetta prima della fine del periodo (${formatShort(end)}). Se non si invia, il contratto si rinnova automaticamente.`,
    shiftIfHoliday: false,
  });

  return out;
}

/**
 * Unisce le scadenze rigenerate con quelle esistenti, preservando storico e completamenti:
 * se una scadenza esistente è già più avanti (perché completata) si mantiene la sua data.
 */
export function mergeContractDeadlines(generated: Deadline[], existing: Deadline[]): Deadline[] {
  return generated.map((g) => {
    const old = existing.find((e) => e.id === g.id);
    if (!old) return g;
    const keepDate = old.dueDate > g.dueDate && old.status === "todo" ? old.dueDate : g.dueDate;
    const doneSameDate = old.status === "done" && old.history[0]?.nominalDueDate === g.dueDate;
    return {
      ...g,
      dueDate: keepDate,
      history: old.history,
      createdAt: old.createdAt,
      status: doneSameDate ? "done" : "todo",
    };
  });
}

function eur(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

