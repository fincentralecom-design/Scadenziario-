import { describe, expect, it } from "vitest";
import { localAnswer } from "@/lib/localAnswer";
import { quickParse } from "@/lib/quickParse";
import { buildSeed } from "@/lib/seed";

const today = "2026-11-07";
const data = buildSeed(today);

describe("chatbot di base", () => {
  it("riconosce le parole corte come IMU", () => {
    const a = localAnswer("imu?", data, today);
    expect(a).toContain("Saldo IMU Annuale");
    expect(a).toContain("3918");
    expect(a).not.toContain("ISTAT");
  });
  it("risponde sui mesi contando le ripetizioni mensili", () => {
    const a = localAnswer("cosa scade a dicembre?", data, today);
    expect(a).toContain("dicembre 2026");
    expect(a).toContain("Flussi Turistici ISTAT");
    expect(a).toContain("Saldo IMU");
  });
  it("dice che in settimana non scade nulla", () => {
    expect(localAnswer("cosa scade questa settimana?", data, today)).toMatch(/non scade nulla/);
  });
  it("gestisce ultima volta pagato", () => {
    expect(localAnswer("quando ho pagato l'ultima volta la TARI?", data, today)).toMatch(/non risulta ancora fatta/);
  });
  it("domanda incomprensibile: suggerisce esempi", () => {
    expect(localAnswer("ciao come stai", data, today)).toMatch(/Prova così/);
  });
});

describe("assistente di base (inserimento)", () => {
  it("crea due scadenze da una frase", () => {
    const r = quickParse("Assicurazione struttura il 20 dicembre 350 euro ogni anno; TARI il 16 di ogni mese codice 3944", today);
    expect(r.deadlines).toHaveLength(2);
    expect(r.deadlines[0]).toMatchObject({ dueDate: "2026-12-20", recurrence: "annuale", amount: 350 });
    expect(r.deadlines[1]).toMatchObject({ dueDate: "2026-11-16", recurrence: "mensile", f24Code: "3944" });
  });
});
