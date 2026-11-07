// Assistente AI (Claude) che trasforma frasi libere o dettate in scadenze strutturate.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { formatLong } from "./dates";
import { quickParse, type DeadlineDraft } from "./quickParse";

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

const SYSTEM = `Sei l'assistente dello "Scadenziario Greco", un'app per un affittacamere con Partita IVA in Italia che gestisce scadenze fiscali, turistiche, di affitti e di manutenzione. L'utente è spesso una persona anziana: scrive o detta a voce frasi brevi e informali, a volte con errori di dettatura.

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

export function aiConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function runAssistant(turns: ChatTurn[], today: string): Promise<{ reply: string; deadlines: DeadlineDraft[]; mode: "ai" | "base" }> {
  const last = [...turns].reverse().find((t) => t.role === "user")?.content ?? "";
  if (!aiConfigured()) return { ...quickParse(last, today), mode: "base" };

  const client = new Anthropic();
  // La data di oggi va in fondo (non nel prompt di sistema) per non invalidare la cache.
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.slice(-12).map((t) => ({ role: t.role, content: t.content }));
  messages.push({ role: "user", content: `(Oggi è ${formatLong(today)}, ${today}.)` });

  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(ReplySchema) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { ...quickParse(last, today), mode: "base" };
    }
    const deadlines = response.parsed_output.deadlines.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.dueDate) && d.title.trim());
    return { reply: response.parsed_output.reply, deadlines, mode: "ai" };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return { ...quickParse(last, today), reply: `${quickParse(last, today).reply} (Chiave AI non valida: uso l'interprete di base.)`, mode: "base" };
    }
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.APIConnectionError || e instanceof Anthropic.InternalServerError) {
      return { ...quickParse(last, today), mode: "base" };
    }
    throw e;
  }
}
