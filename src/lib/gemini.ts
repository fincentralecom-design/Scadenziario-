// Google Gemini (API di Google AI Studio, con livello gratuito): usato da chat e assistente.
// Attivo quando è impostata GEMINI_API_KEY.
import "server-only";

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY?.trim();
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";
}

export interface GeminiTurn {
  role: "user" | "assistant";
  content: string;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Una chiamata a Gemini: restituisce il testo della risposta (JSON se richiesto). */
export async function geminiGenerate(opts: { system: string; turns: GeminiTurn[]; json?: boolean }): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel())}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY!.trim() },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: opts.turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
      generationConfig: {
        temperature: opts.json ? 0.2 : 0.7,
        maxOutputTokens: 8192,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    error?: { message?: string };
  };
  if (!res.ok) throw new GeminiError(data.error?.message || `Gemini HTTP ${res.status}`, res.status);
  if (data.promptFeedback?.blockReason) throw new GeminiError(`Richiesta bloccata (${data.promptFeedback.blockReason})`, 400);
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new GeminiError(`Risposta vuota (${data.candidates?.[0]?.finishReason ?? "sconosciuto"})`, 502);
  return text;
}

/** Estrae il primo oggetto JSON dalla risposta (a volte arriva tra ```json ... ```). */
export function parseJsonLoose(text: string): unknown {
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("JSON non valido");
  }
}
