// Assistente AI (Google Gemini) che trasforma frasi libere o dettate in scadenze strutturate.
import "server-only";
import { z } from "zod";
import { formatLong } from "./dates";
import { quickParse, type DeadlineDraft } from "./quickParse";
import { geminiConfigured, geminiGenerate, parseJsonLoose } from "./gemini";

const DraftSchema = z.object({
  title: z.string().describe("Titolo breve e chiaro in italiano"),
  category: z.enum(["mensile", "trimestrale", "annuale", "locazione", "sicurezza", "altro"]),
  dueDate: z.string().describe("Prima data di scadenza futura, formato YYYY-MM-DD"),
  recurrence: z.enum(["una_tantum", "mensile", "trimestrale", "semestrale", "annuale"]),
  amount: z.number().nullable().describe("Importo in euro se indicato, altrimenti null"),
  f24Code: z.string().nullable().describe("Codice tributo F24 se pertinente, altrimenti null"),
  portal: z.string().nullable().describe("Dove pagare o inviare (portale, banca, ente), altrimenti null"),
  notes: z.string().nullable().describe("Note operative utili, altrimenti null"),
  shiftIfHoliday: z.boolean().describe("true per scadenze fiscali (slittano al primo giorno lavorativo), false per manutenzioni e impegni privati"),
});

const ReplySchema = z.object({
  reply: z.string().describe("Risposta breve in italiano per l'utente: cosa hai preparato o cosa ti manca"),
  deadlines: z.array(DraftSchema),
});

const SYSTEM = `Sei l'assistente dello "Scadenziario Anthony Greco", un'app per un affittacamere con Partita IVA in Italia che gestisce scadenze fiscali, turistiche, di affitti e di manutenzione. L'utente è spesso una persona anziana: scrive o detta a voce frasi brevi e informali, a volte con errori di dettatura.

Il tuo compito è trasformare ciò che dice in scadenze da salvare.
- Calcola sempre la prima data futura (uguale o successiva a oggi) in formato YYYY-MM-DD. "Il 16 di ogni mese" diventa la prossima data del 16 con ricorrenza mensile.
- Se l'utente nomina un adempimento noto, completa con le tue conoscenze della normativa italiana: codice tributo F24 (es. IMU 3918, ritenute 1040, IVA mensile 6001-6012, bollo fatture 2521-2524, registro affitti 1501), portale e note operative brevi. Non inventare importi: se non sono indicati usa null.
- Se manca un'informazione indispensabile (soprattutto la data), non creare la scadenza: chiedila nella risposta.
- Una richiesta può contenere più scadenze: restituiscile tutte.
- Se l'utente fa una domanda generica sulle scadenze rispondi brevemente in "reply" e lascia "deadlines" vuoto.
- Rispondi sempre in italiano semplice, con frasi corte.`;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** L'AI usata è Google Gemini: attiva quando è impostata GEMINI_API_KEY. */
export function aiConfigured(): boolean {
  return geminiConfigured();
}

const JSON_HINT = `
Rispondi SOLO con un oggetto JSON di questa forma, senza altro testo:
{"reply": "risposta breve in italiano", "deadlines": [{"title": "...", "category": "mensile|trimestrale|annuale|locazione|sicurezza|altro", "dueDate": "YYYY-MM-DD", "recurrence": "una_tantum|mensile|trimestrale|semestrale|annuale", "amount": numero o null, "f24Code": "..." o null, "portal": "..." o null, "notes": "..." o null, "shiftIfHoliday": true|false}]}`;

export async function runAssistant(turns: ChatTurn[], today: string): Promise<{ reply: string; deadlines: DeadlineDraft[]; mode: "ai" | "base" }> {
  const last = [...turns].reverse().find((t) => t.role === "user")?.content ?? "";
  if (!aiConfigured()) return { ...quickParse(last, today), mode: "base" };
  try {
    const text = await geminiGenerate({
      system: SYSTEM + JSON_HINT,
      turns: [...turns.slice(-12), { role: "user", content: `(Oggi è ${formatLong(today)}, ${today}.)` }],
      json: true,
    });
    const parsed = ReplySchema.safeParse(parseJsonLoose(text));
    if (!parsed.success) return { ...quickParse(last, today), mode: "base" };
    const deadlines = parsed.data.deadlines.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.dueDate) && d.title.trim());
    return { reply: parsed.data.reply, deadlines, mode: "ai" };
  } catch (e) {
    console.error("Gemini (assistente):", e);
    return { ...quickParse(last, today), mode: "base" };
  }
}
