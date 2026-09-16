// test/combat/hidden-threat.test.mjs
//
// wdbc-1rno.1: _performHiddenThreatDetect — реальный тест Пси-чутья/
// Ноосканирования с −50 к Порогу, показ успеха/провала в карточке.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { _performHiddenThreatDetect } from "../../module/combat/hidden-threat.mjs";

beforeEach(() => {
  resetCaptured();
});

const actor = (skills) => ({ name: "Наблюдатель", system: { skills } });

describe("_performHiddenThreatDetect", () => {
  it("Пси-чутьё 60, бросок 15 (< 60−50=10? нет) — 15 > 10, провал", async () => {
    captured.nextRoll = 15;
    await _performHiddenThreatDetect(actor({ psyniscience: { total: 60 } }), "psyniscience");
    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("Порог: <b>10</b>"); // 60 − 50
    expect(note).toContain("Провал");
  });

  it("Пси-чутьё 60, бросок 10 (=Порог) — успех, атака засечена", async () => {
    captured.nextRoll = 10;
    await _performHiddenThreatDetect(actor({ psyniscience: { total: 60 } }), "psyniscience");
    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("Успех");
    expect(note).toContain("засечена");
  });

  it("Ноосканирование — другой Навык/Характеристика, тот же −50", async () => {
    captured.nextRoll = 5;
    await _performHiddenThreatDetect(actor({ techUse: { total: 40 } }), "techUse");
    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("Ноосканирование");
    expect(note).toContain("Порог: <b>-10</b>"); // 40 − 50
    expect(note).toContain("Провал"); // бросок 5 > Порога -10
  });

  it("нет такого Навыка у актора — total считается как -20, не бросает", async () => {
    captured.nextRoll = 1;
    await _performHiddenThreatDetect(actor({}), "psyniscience");
    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("Порог: <b>-70</b>"); // -20 − 50
  });

  it("неизвестный skillKey — тихо ничего не делает, карточка не постится", async () => {
    await _performHiddenThreatDetect(actor({ psyniscience: { total: 60 } }), "awareness");
    expect(captured.chat.length).toBe(0);
  });
});
