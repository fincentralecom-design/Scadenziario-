import { describe, expect, it } from "vitest";
import { addMonths, easterSunday, isBusinessDay, nextBusinessDay } from "@/lib/dates";
import { completeDeadline, daysLeft, effectiveDate, f24CodeFor, rollForward, undoLastCompletion, bucketOf, calculate } from "@/lib/deadlines";
import { bolloContratto, generateContractDeadlines, registroAnnuo } from "@/lib/contracts";
import { alertKindFor, collectAlerts } from "@/lib/alerts";
import { buildSeed } from "@/lib/seed";
import { DEFAULT_SETTINGS, type Contract, type Deadline } from "@/lib/types";

const mk = (over: Partial<Deadline>): Deadline => ({
  id: "x", title: "Test", category: "altro", dueDate: "2026-11-16", recurrence: "mensile",
  shiftIfHoliday: true, active: true, status: "todo", history: [], createdAt: "", updatedAt: "", ...over,
});

describe("calendario fiscale", () => {
  it("calcola la Pasqua", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });
  it("riconosce festivi e weekend", () => {
    expect(isBusinessDay("2026-04-06")).toBe(false); // Pasquetta
    expect(isBusinessDay("2026-06-02")).toBe(false);
    expect(isBusinessDay("2026-10-05")).toBe(true);
    expect(isBusinessDay("2026-11-14")).toBe(false); // sabato
  });
  it("sposta al primo giorno lavorativo", () => {
    expect(nextBusinessDay("2026-05-16")).toBe("2026-05-18"); // sabato → lunedì
    expect(nextBusinessDay("2026-08-15")).toBe("2026-08-17"); // Ferragosto (sab) → lunedì
    expect(nextBusinessDay("2026-12-26")).toBe("2026-12-28");
    expect(nextBusinessDay("2027-10-04")).toBe("2027-10-05"); // San Francesco (lunedì)
  });
  it("mantiene il giorno àncora sui mesi corti", () => {
    expect(addMonths("2027-01-31", 1, 31)).toBe("2027-02-28");
    expect(addMonths("2027-02-28", 1, 31)).toBe("2027-03-31");
    expect(addMonths("2027-02-28", 12, 31)).toBe("2028-02-29");
  });
});

describe("scadenze", () => {
  it("rigenera la scadenza mensile e permette l'annullamento", () => {
    const d = mk({ dueDate: "2026-11-16", anchorDay: 16 });
    const done = completeDeadline(d, { note: "ok" });
    expect(done.dueDate).toBe("2026-12-16");
    expect(done.status).toBe("todo");
    expect(done.history).toHaveLength(1);
    const undone = undoLastCompletion(done);
    expect(undone.dueDate).toBe("2026-11-16");
    expect(undone.history).toHaveLength(0);
  });
  it("chiude le una tantum e rispetta endDate", () => {
    expect(completeDeadline(mk({ recurrence: "una_tantum" })).status).toBe("done");
    expect(completeDeadline(mk({ recurrence: "annuale", endDate: "2027-01-01" })).status).toBe("done");
  });
  it("calcola giorni rimanenti sulla data utile e il semaforo", () => {
    const d = mk({ dueDate: "2026-11-14" }); // sabato → lun 16
    expect(effectiveDate(d)).toBe("2026-11-16");
    expect(daysLeft(d, "2026-11-13")).toBe(3);
    expect(bucketOf(d, "2026-11-13")).toBe("orange");
    expect(bucketOf(d, "2026-11-17")).toBe("red");
    expect(bucketOf(d, "2026-11-01")).toBe("yellow");
  });
  it("calcola il codice tributo IVA mensile", () => {
    expect(f24CodeFor(mk({ f24Auto: "iva_mensile", dueDate: "2026-12-16" }))).toMatch(/^6011/);
    expect(f24CodeFor(mk({ f24Auto: "iva_mensile", dueDate: "2027-01-16" }))).toMatch(/^6012/);
  });
  it("calcolatori", () => {
    expect(calculate({ type: "percent", rate: 22, baseLabel: "" }, 1000)).toBe(220);
    expect(calculate({ type: "percent", rate: 2, baseLabel: "", min: 67 }, 1000)).toBe(67);
    expect(calculate({ type: "perUnit", unitAmount: 2, unitLabel: "" }, 15)).toBe(30);
  });
  it("rollForward porta alla prima occorrenza futura", () => {
    expect(rollForward(mk({ dueDate: "2026-01-05", shiftIfHoliday: false, anchorDay: 5 }), "2026-11-07").dueDate).toBe("2026-12-05");
  });
  it("seed: tutte le scadenze sono future e uniche", () => {
    const seed = buildSeed("2026-11-07");
    expect(seed.length).toBeGreaterThan(25);
    expect(new Set(seed.map((d) => d.id)).size).toBe(seed.length);
    seed.forEach((d) => expect(effectiveDate(d) >= "2026-11-07").toBe(true));
    expect(seed.find((d) => d.seedKey === "bollo-q4")!.dueDate).toBe("2027-02-28");
    expect(seed.find((d) => d.seedKey === "inps-fissi-3")!.dueDate).toBe("2026-11-16");
  });
});

describe("contratti", () => {
  const c: Contract = {
    id: "c1", tenant: "Rossi", property: "Via Roma 1", startDate: "2025-03-01", annualRent: 7200, cedolare: false,
    initialYears: 4, renewalYears: 4, facciate: 6, copie: 1, alreadyRegistered: true, active: true, createdAt: "", updatedAt: "",
  };
  it("calcola registro e bollo", () => {
    expect(registroAnnuo(7200)).toBe(144);
    expect(registroAnnuo(1000)).toBe(67);
    expect(bolloContratto(6, 1)).toBe(32);
  });
  it("genera annualità, proroga e disdetta", () => {
    const list = generateContractDeadlines(c, "2026-11-07");
    const ann = list.find((d) => d.id.endsWith("annualita"))!;
    expect(ann.dueDate).toBe("2027-03-31");
    expect(ann.f24Code).toContain("1501");
    expect(ann.endDate).toBe("2028-03-31");
    expect(list.find((d) => d.id.endsWith("proroga"))!.dueDate).toBe("2029-03-31");
    expect(list.find((d) => d.id.endsWith("disdetta"))!.dueDate).toBe("2028-09-01");
    expect(list.find((d) => d.id.endsWith("rli"))).toBeUndefined();
  });
  it("in cedolare secca non genera le annualità", () => {
    const list = generateContractDeadlines({ ...c, cedolare: true, alreadyRegistered: false }, "2026-11-07");
    expect(list.find((d) => d.id.endsWith("annualita"))).toBeUndefined();
    expect(list.find((d) => d.id.endsWith("rli"))!.amount).toBe(0);
  });
});

describe("motore di allerta", () => {
  it("scatta solo a -3 giorni e il giorno stesso", () => {
    const d = mk({ dueDate: "2026-11-16" });
    expect(alertKindFor(d, "2026-11-13", false)).toBe("preavviso");
    expect(alertKindFor(d, "2026-11-14", false)).toBeNull();
    expect(alertKindFor(d, "2026-11-16", false)).toBe("oggi");
    expect(alertKindFor(d, "2026-11-18", false)).toBeNull();
    expect(alertKindFor(d, "2026-11-18", true)).toBe("sollecito");
    expect(alertKindFor({ ...d, active: false }, "2026-11-16", false)).toBeNull();
  });
  it("compone oggetto e magic link", () => {
    const [a] = collectAlerts([mk({ title: "IVA OTA", dueDate: "2026-11-16" })], "2026-11-13", DEFAULT_SETTINGS, () => "https://x/conferma/x?t=abc");
    expect(a.subject).toBe("⏳ PREAVVISO (-3 giorni): IVA OTA");
    expect(a.emailHtml).toContain("https://x/conferma/x?t=abc");
    expect(a.whatsapp).toContain("https://x/conferma/x?t=abc");
    expect(a.sms).toContain("https://x/conferma/x?t=abc");
  });
});
