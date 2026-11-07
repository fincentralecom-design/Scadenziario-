import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/service", () => ({ listDeadlines: async () => [], getSettings: async () => ({}) }));

describe("assistente con Gemini (risposte simulate)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
  });

  it("chiama l'API Gemini e legge le bozze JSON", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '```json\n{"reply":"Fatto","deadlines":[{"title":"IMU acconto","category":"annuale","dueDate":"2027-06-16","recurrence":"annuale","amount":null,"f24Code":"3918","portal":null,"notes":null,"shiftIfHoliday":true}]}\n```' }] } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { runAssistant } = await import("@/lib/assistant");
    const r = await runAssistant([{ role: "user", content: "IMU il 16 giugno" }], "2026-11-07");
    expect(r.mode).toBe("ai");
    expect(r.deadlines[0]).toMatchObject({ title: "IMU acconto", f24Code: "3918" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
  });

  it("se Gemini dà errore usa l'interprete di base", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 })));
    const { runAssistant } = await import("@/lib/assistant");
    const r = await runAssistant([{ role: "user", content: "Assicurazione il 20 dicembre 300 euro" }], "2026-11-07");
    expect(r.mode).toBe("base");
    expect(r.deadlines[0].dueDate).toBe("2026-12-20");
  });
});
