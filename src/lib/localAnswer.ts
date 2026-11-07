// Risposte "di base" (senza AI) alle domande sui dati dello scadenziario.
// Riconosce argomenti (IMU, IVA, TARI...), periodi (oggi, settimana, "a dicembre"...) e intenzioni
// (quando, quanto, ultima volta pagato, scadute, completate) e risponde con i dati reali.
import { addDays, formatLong, formatShort, makeDate, parseDate, MONTHS_IT } from "./dates";
import { daysLeft, effectiveDate, f24CodeFor, formatEuro, nextNominalDate, sortByDate } from "./deadlines";
import { CATEGORY_LABELS, RECURRENCE_LABELS, type Category, type Deadline } from "./types";

const STOP = new Set(
  "il lo la i gli le un uno una di a da in con su per tra fra e o ed che chi cosa come quando quanto quanti quante quale quali dove mi ti ci si devo dobbiamo bisogna scade scadono scadenza scadenze prossima prossimo prossime prossimi ultima ultimo volta pagato pagata pagare pago fatto fatta fare ho hai ha abbiamo del dello della dei degli delle al allo alla ai agli alle nel nello nella nei negli nelle sul sulla sui è sono c'è ce qual mio mia miei mie nostro nostra questo questa questi queste quello quella mese mesi anno anni settimana giorni giorno oggi domani entro elenco lista dimmi dammi mostra fammi vedere sapere vorrei voglio puoi favore grazie tutte tutti tutto importo importi totale pagamento pagamenti già l'ho"
    .split(" "),
);

/** Sinonimi: parola della domanda → parole da cercare nelle scadenze. */
const SYNONYMS: Record<string, string[]> = {
  imu: ["imu"],
  iva: ["iva"],
  tari: ["tari", "rifiuti"],
  rifiuti: ["tari"],
  inps: ["inps", "contributi"],
  contributi: ["inps", "contributi"],
  bollo: ["bollo"],
  bolli: ["bollo"],
  affitto: ["locazion", "registro", "contratto", "affitt"],
  affitti: ["locazion", "registro", "contratto", "affitt"],
  locazione: ["locazion", "registro", "contratto"],
  registro: ["registro"],
  istat: ["istat", "flussi"],
  turistici: ["istat", "flussi"],
  soggiorno: ["soggiorno"],
  caldaia: ["caldaia"],
  estintori: ["estintori"],
  estintore: ["estintori"],
  rai: ["rai"],
  canone: ["rai", "canone"],
  ota: ["ota"],
  booking: ["ota"],
  airbnb: ["ota"],
  autofatture: ["autofatture", "td17"],
  ritenute: ["ritenute"],
  irpef: ["irpef", "acconto", "redditi"],
  tasse: ["imposte", "irpef", "acconto"],
  imposte: ["imposte"],
  acconto: ["acconto"],
  saldo: ["saldo"],
  redditi: ["redditi"],
  dichiarazione: ["dichiarazione", "modello"],
  cu: ["certificazione"],
  lipe: ["lipe", "liquidazioni"],
  alloggiati: ["alloggiati"],
  questura: ["alloggiati"],
};

const CATEGORY_WORDS: [RegExp, Category][] = [
  [/mensil/, "mensile"],
  [/trimestral/, "trimestrale"],
  [/annual/, "annuale"],
  [/sicurezz|manutenz/, "sicurezza"],
  [/personalizzat/, "altro"],
];

interface Occurrence {
  d: Deadline;
  date: string;
}

/** Tutte le occorrenze (anche ripetute, es. mensili) delle scadenze attive tra due date. */
function occurrences(list: Deadline[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const d of list) {
    if (!d.active || d.status !== "todo") continue;
    let cur: Deadline | null = d;
    let guard = 0;
    while (cur && guard++ < 60) {
      const date = effectiveDate(cur);
      if (date > to) break;
      if (date >= from) out.push({ d: cur, date });
      const next = nextNominalDate(cur);
      cur = next && (!cur.endDate || next <= cur.endDate) ? { ...cur, dueDate: next } : null;
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.d.title.localeCompare(b.d.title));
}

function occLine(o: Occurrence): string {
  const code = f24CodeFor(o.d);
  return `• ${formatShort(o.date)} – ${o.d.title}${o.d.amount ? ` (${formatEuro(o.d.amount)})` : ""}${code ? ` · F24 ${code.split(" (")[0]}` : ""}`;
}

/** Descrizione completa di una scadenza. */
function describe(d: Deadline, today: string): string {
  const lines: string[] = [`📌 ${d.title}`];
  if (!d.active) lines.push("È disattivata (non ricevi avvisi).");
  else if (d.status === "done") lines.push("È completata.");
  else {
    const n = daysLeft(d, today);
    lines.push(`📅 Prossima scadenza: ${formatLong(effectiveDate(d))} (${n === 0 ? "oggi" : n > 0 ? `tra ${n} giorni` : `scaduta da ${-n} giorni`})`);
  }
  lines.push(`🔁 ${RECURRENCE_LABELS[d.recurrence]}`);
  if (d.amount) lines.push(`💶 Importo: ${formatEuro(d.amount)}`);
  const code = f24CodeFor(d);
  if (code) lines.push(`🧾 Codice F24: ${code}`);
  if (d.portal) lines.push(`🌐 Dove: ${d.portal}`);
  if (d.specialRule) lines.push(`ℹ️ ${d.specialRule}`);
  const h = d.history[0];
  lines.push(
    h
      ? `✅ Ultima volta fatta il ${new Date(h.completedAt).toLocaleDateString("it-IT")}${h.amountPaid ? `, pagati ${formatEuro(h.amountPaid)}` : ""}${h.note ? ` (nota: ${h.note})` : ""}`
      : "✅ Non risulta ancora fatta nessuna volta.",
  );
  return lines.join("\n");
}

/** Periodo richiesto: oggi, domani, settimana, mese, un mese per nome, anno. */
function periodOf(q: string, today: string): { from: string; to: string; label: string } | null {
  const t = parseDate(today);
  const year = t.getUTCFullYear();
  const month = t.getUTCMonth() + 1;
  for (let i = 0; i < 12; i++) {
    if (new RegExp(`\\b${MONTHS_IT[i]}\\b`).test(q)) {
      const explicit = q.match(/\b(20\d\d)\b/);
      const y = explicit ? Number(explicit[1]) : i + 1 < month ? year + 1 : year;
      const from = makeDate(y, i + 1, 1);
      const to = makeDate(y, i + 2, 0);
      return { from: from < today ? today : from, to, label: `a ${MONTHS_IT[i]} ${y}` };
    }
  }
  if (/\boggi\b/.test(q)) return { from: today, to: today, label: "oggi" };
  if (/\bdomani\b/.test(q)) return { from: addDays(today, 1), to: addDays(today, 1), label: "domani" };
  if (/settimana prossima|prossima settimana/.test(q)) return { from: addDays(today, 7), to: addDays(today, 14), label: "la settimana prossima" };
  if (/settiman|7 giorni|sette giorni/.test(q)) return { from: today, to: addDays(today, 7), label: "nei prossimi 7 giorni" };
  if (/questo mese|fine mese/.test(q)) return { from: today, to: makeDate(year, month + 1, 0), label: "entro la fine del mese" };
  if (/mese prossimo|prossimo mese/.test(q)) return { from: makeDate(year, month + 1, 1), to: makeDate(year, month + 2, 0), label: "il mese prossimo" };
  if (/(3|tre) mesi|trimestre/.test(q)) return { from: today, to: addDays(today, 92), label: "nei prossimi 3 mesi" };
  if (/(6|sei) mesi|semestre/.test(q)) return { from: today, to: addDays(today, 183), label: "nei prossimi 6 mesi" };
  if (/quest.anno|fine anno|entro l.anno/.test(q)) return { from: today, to: makeDate(year, 12, 31), label: "entro fine anno" };
  if (/prossimo anno|anno prossimo/.test(q)) return { from: makeDate(year + 1, 1, 1), to: makeDate(year + 1, 12, 31), label: `nel ${year + 1}` };
  const m = q.match(/(\d+)\s*giorni/);
  if (m) return { from: today, to: addDays(today, Number(m[1])), label: `nei prossimi ${m[1]} giorni` };
  if (/\bmese\b/.test(q)) return { from: today, to: addDays(today, 30), label: "nei prossimi 30 giorni" };
  return null;
}

/** Scadenze che corrispondono alle parole della domanda (argomento, codice F24...). */
function topicMatches(q: string, deadlines: Deadline[]): Deadline[] {
  const words = q.split(/[^a-z0-9àèéìòù]+/).filter((w) => w.length >= 2 && !STOP.has(w) && !MONTHS_IT.includes(w) && !/^20\d\d$/.test(w));
  if (!words.length) return [];
  const scored = deadlines
    .map((d) => {
      const title = d.title.toLowerCase();
      const hay = `${d.description ?? ""} ${d.notes ?? ""} ${f24CodeFor(d) ?? ""} ${CATEGORY_LABELS[d.category]}`.toLowerCase();
      let score = 0;
      for (const w of words) {
        const terms = SYNONYMS[w] ?? (w.length >= 4 ? [w.slice(0, Math.max(4, w.length - 1))] : /^\d{4}$/.test(w) ? [w] : []);
        const re = (t: string) => new RegExp(`(^|[^a-zàèéìòù])${t}`);
        if (terms.some((t) => re(t).test(title))) score += 3;
        else if (terms.some((t) => re(t).test(hay))) score += 1;
      }
      return { d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  const best = scored[0].score;
  return sortByDate(scored.filter((x) => x.score >= Math.max(1, best - 1)).map((x) => x.d));
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function localAnswer(question: string, deadlines: Deadline[], today: string): string {
  const q = question.toLowerCase().replace(/[’`]/g, "'");
  const active = deadlines.filter((d) => d.active);
  const todo = sortByDate(active.filter((d) => d.status === "todo"));
  let topic = topicMatches(q, deadlines);
  const cat = CATEGORY_WORDS.find(([re]) => re.test(q))?.[1];
  if (!topic.length && cat) topic = sortByDate(active.filter((d) => d.category === cat));
  const period = periodOf(q, today);
  const askLast = /ultima volta|quando ho|l'ho|ho già|già pagat|già fatt|storico/.test(q);
  const askMoney = /quanto|totale|spend|soldi|costa|cost[oi]|import/.test(q);

  // 1) Scadute
  if (/scadut|ritardo|arretrat|dimenticat|non pagat|superat/.test(q)) {
    const late = todo.filter((d) => daysLeft(d, today) < 0);
    return late.length ? `Scadenze superate e non ancora confermate:\n${late.map((d) => occLine({ d, date: effectiveDate(d) })).join("\n")}` : "Non ci sono scadenze superate. 👍";
  }

  // 2) Cose fatte di recente
  if (/complet|fatte|cosa ho fatto|pagamenti fatti|ho pagato/.test(q) && !topic.length) {
    const done = deadlines
      .flatMap((d) => d.history.map((h) => ({ d, h })))
      .sort((a, b) => b.h.completedAt.localeCompare(a.h.completedAt))
      .slice(0, 10);
    return done.length
      ? `Ultime cose fatte:\n${done.map(({ d, h }) => `• ${new Date(h.completedAt).toLocaleDateString("it-IT")} – ${d.title}${h.amountPaid ? ` (${formatEuro(h.amountPaid)})` : ""}`).join("\n")}`
      : "Non risulta ancora nessuna scadenza completata.";
  }

  // 3) Argomento specifico: "imu?", "quando scade la TARI", "ultima volta pagato l'IVA"
  if (topic.length) {
    if (askLast) {
      return topic
        .slice(0, 5)
        .map((d) => {
          const h = d.history[0];
          return h
            ? `“${d.title}”: ultima volta fatta il ${new Date(h.completedAt).toLocaleDateString("it-IT")}${h.amountPaid ? `, pagati ${formatEuro(h.amountPaid)}` : ""}${h.note ? ` (nota: ${h.note})` : ""}.`
            : `“${d.title}”: non risulta ancora fatta.`;
        })
        .join("\n");
    }
    if (period) {
      const occ = occurrences(topic, period.from, period.to);
      return occ.length ? `${capital(period.label)}:\n${occ.map(occLine).join("\n")}` : `${capital(period.label)} non ci sono scadenze di questo tipo.`;
    }
    if (topic.length > 4) {
      return `Ho trovato ${topic.length} scadenze:\n${topic.map((d) => occLine({ d, date: effectiveDate(d) })).join("\n")}\n\nScrivi il nome preciso per avere i dettagli.`;
    }
    return topic.map((d) => describe(d, today)).join("\n\n");
  }

  // 4) Contratti di affitto
  if (/contratt|inquilin/.test(q)) {
    const linked = todo.filter((d) => d.contractId);
    return linked.length
      ? `Scadenze dei contratti di affitto:\n${linked.map((d) => occLine({ d, date: effectiveDate(d) })).join("\n")}`
      : "Non ci sono scadenze di contratti di affitto. Puoi inserirli nella scheda Affitti.";
  }

  // 5) Periodo, con o senza importi
  if (period || askMoney) {
    const p = period ?? { from: today, to: addDays(today, 30), label: "nei prossimi 30 giorni" };
    const occ = occurrences(todo, p.from, p.to);
    if (!occ.length) {
      const next = todo.slice(0, 5).map((d) => occLine({ d, date: effectiveDate(d) }));
      return `${capital(p.label)} non scade nulla. 👍${next.length ? `\nLe prossime sono:\n${next.join("\n")}` : ""}`;
    }
    if (askMoney) {
      const total = occ.reduce((s, o) => s + (o.d.amount ?? 0), 0);
      const missing = occ.filter((o) => !o.d.amount).length;
      const head = total
        ? `${capital(p.label)} gli importi inseriti sommano ${formatEuro(total)}${missing ? ` (più ${missing} scadenze senza importo)` : ""}.`
        : `${capital(p.label)} ci sono ${occ.length} scadenze, ma nessuna ha un importo inserito (puoi aggiungerlo con “Modifica” o col calcolatore).`;
      return `${head}\n${occ.map(occLine).join("\n")}`;
    }
    return `${capital(p.label)} (${occ.length}):\n${occ.map(occLine).join("\n")}`;
  }

  // 6) Domanda generica sulle prossime scadenze
  if (/prossim|cosa (devo|c'è)|scaden|da fare|agenda/.test(q)) {
    return `Le prossime scadenze sono:\n${todo.slice(0, 8).map((d) => occLine({ d, date: effectiveDate(d) })).join("\n")}`;
  }

  return [
    "Non ho capito bene la domanda. Prova così:",
    "• “Quando scade l'IMU?”",
    "• “Cosa scade a dicembre?”",
    "• “Quanto devo pagare questo mese?”",
    "• “Quando ho pagato l'ultima volta la TARI?”",
    "• “Ci sono scadenze superate?”",
  ].join("\n");
}
