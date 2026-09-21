// test/combat/tear-open.test.mjs
//
// Разорвать (стр. 27): S.b+T.b > АР цели → полудействие без броска; иначе
// расширить до Полного действия, тест Athletics(S)+0, +1 S.b+T.b за Успех,
// 2+ Провала — 1 Усталости. wdbc-x1nz.2.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sbPlusTb, useTearOpen } from "../../module/combat/tear-open.mjs";

function actor({ sb = 4, tb = 3, athletics = 40, ap = 2, fatigue = 0 } = {}) {
  const a = {
    id: "a1", name: "Гвардеец", type: "character",
    system: {
      characteristics: { s: { bonus: sb }, t: { bonus: tb } },
      skills: { athletics: { total: athletics } },
      actionPoints: { value: ap, max: 2 },
      fatigue: { value: fatigue, max: 0 }
    },
    update: async (data) => {
      if ("system.fatigue.value" in data) a.system.fatigue.value = data["system.fatigue.value"];
    }
  };
  return a;
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 0 };
});
afterEach(() => { delete globalThis.game.combat; });

describe("sbPlusTb", () => {
  it("сумма S.b + T.b", () => {
    expect(sbPlusTb(actor({ sb: 4, tb: 3 }))).toBe(7);
  });
});

describe("useTearOpen — за полудействие (extended:false)", () => {
  it("S.b+T.b > АР — успех без броска", async () => {
    const a = actor({ sb: 4, tb: 3 }); // 7
    await useTearOpen(a, { targetAP: 5, extended: false });
    expect(captured.chat.length).toBe(1);
    expect(captured.rolls.length).toBe(0); // без броска
    expect(captured.chat[0].content).toContain("вырвано без броска");
  });

  it("S.b+T.b ≤ АР — предупреждает, ОД не тратятся", async () => {
    globalThis.game.combat = { started: true };
    const a = actor({ sb: 4, tb: 3, ap: 2 }); // 7
    await useTearOpen(a, { targetAP: 7, extended: false });
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat.length).toBe(0);
    expect(a.system.actionPoints.value).toBe(2); // не потрачено
  });

  it("в бою, не хватает 1 ОД — предупреждает", async () => {
    globalThis.game.combat = { started: true };
    const a = actor({ sb: 4, tb: 3, ap: 0 });
    await useTearOpen(a, { targetAP: 5, extended: false });
    expect(captured.warnings.length).toBe(1);
  });
});

describe("useTearOpen — расширенное (extended:true)", () => {
  it("успех теста — S.b+T.b + Успехи > АР — вырвано", async () => {
    captured.nextRoll = 10; // Athletics 40 → успех, ~4 Усп.
    const a = actor({ sb: 1, tb: 1, athletics: 40 }); // sbtb=2
    await useTearOpen(a, { targetAP: 4, extended: true });
    expect(captured.chat[0].content).toContain("Вырвано");
  });

  it("успех теста, но всё равно не хватает — не вырвано, Усталость не даётся (успех — не 2+ Провала)", async () => {
    captured.nextRoll = 38; // Athletics 40 → успех, 1 Усп. (deg=1)
    const a = actor({ sb: 1, tb: 1, athletics: 40 }); // sbtb=2, +1=3
    await useTearOpen(a, { targetAP: 10, extended: true });
    expect(captured.chat[0].content).toContain("Не вырвано");
    expect(a.system.fatigue.value).toBe(0);
  });

  it("провал с 2+ степенями — 1 Усталости", async () => {
    captured.nextRoll = 99; // Athletics 40 → грубый провал, deg>=2
    const a = actor({ sb: 1, tb: 1, athletics: 40, fatigue: 0 });
    await useTearOpen(a, { targetAP: 10, extended: true });
    expect(a.system.fatigue.value).toBe(1);
  });

  it("не хватает 2 ОД на Полное действие — предупреждает", async () => {
    globalThis.game.combat = { started: true };
    const a = actor({ ap: 1 });
    await useTearOpen(a, { targetAP: 10, extended: true });
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat.length).toBe(0);
  });
});
