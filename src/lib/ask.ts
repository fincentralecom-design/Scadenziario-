// "Chiedi allo Scadenziario": Claude risponde alle domande leggendo tutti i dati dell'app.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { listAudit } from "./audit";
import { aiConfigured, aiModel, fallbackParams, type ChatTurn } from "./assistant";
import { formatLong } from "./dates";
import { daysLeft, effectiveDate, f24CodeFor } from "./deadlines";
import { localAnswer } from "./localAnswer";
import { getSettings, listDeadlines } from "./service";
import { getStore } from "./store";

const SYSTEM = `Sei l'assistente personale dello "Scadenziario Anthony Greco", l'app con cui la famiglia Greco gestisce un affittacamere con Partita IVA in Italia: tasse, F24, IVA sulle commissioni OTA, imposta di soggiorno, ISTAT, contratti di affitto, manutenzioni. Chi ti scrive è spesso Anthony Greco, il titolare: parla con lui come farebbe un assistente cordiale e paziente, in modo naturale, come una conversazione vera.

Come comportarti:
- Conversa liberamente: rispondi a saluti, domande generali, curiosità, richieste di spiegazioni (es. "cos'è l'F24?", "come si paga col home banking?", "che differenza c'è tra cedolare secca e regime ordinario?"). Non limitarti a elenchi.
- Quando la domanda riguarda le sue scadenze, i pagamenti fatti, i contratti o chi ha modificato qualcosa, usa i dati dell'app che trovi all'inizio della conversazione: sono la fonte di verità. Non inventare scadenze, date o importi che non ci sono; se un dato manca, dillo e suggerisci dove inserirlo.
- Sulla normativa fiscale italiana puoi spiegare in generale, ricordando con garbo che i casi specifici vanno verificati col commercialista.
- Ragiona sulle date: "oggi" è indicato nei dati. Calcola giorni mancanti, cosa scade in un certo mese, totali degli importi, ricorrenze (una scadenza mensile si ripete ogni mese).
- Per "chi ha fatto cosa" usa il diario: ogni voce ha data, persona e cambiamenti (prima → dopo).
- Non puoi modificare i dati da qui: se te lo chiede, spiega con parole semplici dove farlo nell'app (Cruscotto per segnare come pagato, Aggiungi per nuove scadenze o con l'assistente vocale, Affitti per i contratti, Impostazioni per avvisi, password e diario).
- Stile: italiano semplice e caldo, frasi brevi, niente gergo inutile. Date in formato italiano (es. lunedì 16 novembre 2026), importi in euro. Niente tabelle o markdown complesso: al massimo elenchi con "•" e qualche emoji quando aiuta. Risposte brevi per domande semplici, più complete quando serve.`;

/** Tutti i dati utili, in forma compatta (senza ricevute allegate né segreti). */
async function buildContext(today: string): Promise<string> {
  const [deadlines, contracts, audit, settings] = await Promise.all([listDeadlines(), getStore().listContracts(), listAudit(), getSettings()]);
  const data = {
    oggi: today,
    scadenze: deadlines.map((d) => ({
      titolo: d.title,
      categoria: d.category,
      prossima_data_utile: effectiveDate(d),
      giorni_mancanti: d.status === "todo" ? daysLeft(d, today) : null,
      stato: !d.active ? "disattivata" : d.status === "done" ? "completata" : "da fare",
      ricorrenza: d.recurrence,
      importo: d.amount ?? null,
      codice_f24: f24CodeFor(d) ?? null,
      dove: d.portal ?? null,
      descrizione: d.description ?? null,
      note: d.notes ?? null,
      regola_speciale: d.specialRule ?? null,
      contratto: d.contractId ?? null,
      storico: d.history.slice(0, 12).map((h) => ({
        scadenza_del: h.dueDate,
        fatto_il: h.completedAt.slice(0, 10),
        importo_pagato: h.amountPaid ?? null,
        nota: h.note ?? null,
        ricevuta: !!(h.receiptName || h.receiptData),
        come: h.via === "magic-link" ? "dal link ricevuto" : "dall'app",
      })),
    })),
    contratti: contracts.map((c) => ({
      id: c.id,
      inquilino: c.tenant,
      immobile: c.property,
      decorrenza: c.startDate,
      canone_annuo: c.annualRent,
      cedolare_secca: c.cedolare,
      durata: `${c.initialYears}+${c.renewalYears}`,
      note: c.notes ?? null,
    })),
    diario_ultime_attivita: audit.slice(0, 150).map((a) => ({
      quando: a.at,
      chi: a.actor,
      azione: a.action,
      su: a.target,
      dettagli: a.summary,
      cambiamenti: a.changes,
    })),
    impostazioni_avvisi: {
      destinatario: settings.recipientName,
      canali_attivi: Object.entries(settings.channels).filter(([, v]) => v).map(([k]) => k),
      sollecito_scadute: settings.overdueReminder,
    },
  };
  return JSON.stringify(data);
}

export async function askScadenziario(turns: ChatTurn[], today: string): Promise<{ answer: string; mode: "ai" | "base" }> {
  const question = [...turns].reverse().find((t) => t.role === "user")?.content ?? "";
  if (!aiConfigured()) return { answer: localAnswer(question, await listDeadlines(), today), mode: "base" };

  const client = new Anthropic();
  const context = await buildContext(today);
  // I dati vanno nel primo messaggio: la conversazione resta in coda, così la cache del prompt regge.
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      // In cache: le domande successive sugli stessi dati costano circa un decimo.
      content: [{ type: "text", text: `Dati attuali dello scadenziario (oggi è ${formatLong(today)}):\n${context}`, cache_control: { type: "ephemeral" } }],
    },
    { role: "assistant", content: "Ho letto tutti i dati dello scadenziario. Sono pronto a chiacchierare e rispondere a qualsiasi domanda." },
    ...turns.slice(-10).map((t) => ({ role: t.role, content: t.content }) as Anthropic.Beta.BetaMessageParam),
  ];

  try {
    const response = await client.beta.messages.create({
      model: aiModel(),
      max_tokens: 16000,
      ...fallbackParams(),
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
    });
    if (response.stop_reason === "refusal") {
      return { answer: "Non posso rispondere a questa domanda. Prova a riformularla.", mode: "ai" };
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { answer: text || "Non ho trovato una risposta.", mode: "ai" };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.APIConnectionError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.AuthenticationError) {
      return { answer: localAnswer(question, await listDeadlines(), today), mode: "base" };
    }
    throw e;
  }
}
