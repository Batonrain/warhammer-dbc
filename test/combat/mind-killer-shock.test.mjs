// test/combat/mind-killer-shock.test.mjs
//
// Mind Killer / Убийца Разума: «отнимает ½I (окр.▼) от бросков на Шок»
// (rules/mind-killer.mjs). Проверяется дорога до карточки: провал теста
// Страха → бросок Шока с вычетом и его подписью.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _executeFearRoll } from "../../module/combat/fear.mjs";
import { mindKillerShockReduction } from "../../module/rules/mind-killer.mjs";

function makeActor({ talent = false, int = 45 } = {}) {
  return {
    id: "a1", name: "Подставной",
    items: talent ? [{ type: "talent", name: "Mind Killer / Убийца Разума", system: {} }] : [],
    system: {
      characteristics: { wp: { total: 30 }, int: { total: int } },
      fatigue: { value: 0, max: 0 },
      fate: { value: 0 }
    },
    getFlag: () => undefined,
    update: async () => {},
    effects: [],
    createEmbeddedDocuments: async () => []
  };
}

beforeEach(resetCaptured);

describe("Убийца Разума", () => {
  it("½I с округлением вниз, без Таланта — 0", () => {
    expect(mindKillerShockReduction(makeActor({ talent: true, int: 45 }))).toBe(22);
    expect(mindKillerShockReduction(makeActor({ talent: false, int: 45 }))).toBe(0);
  });

  it("бросок Шока после провала Страха уменьшается и подписан", async () => {
    captured.dice = [99, 60, 3, 3, 3]; // провал Страха, d100 Шока = 60, запас на сроки строки
    await _executeFearRoll(makeActor({ talent: true, int: 45 }), 1, "important", 0, 0);
    const msg = captured.chat.at(-1).content;
    expect(msg).toContain("−22 Убийца Разума");
  });

  it("без Таланта подписи нет", async () => {
    captured.dice = [99, 60, 3, 3, 3]; // запас на кубики сроков строки Шока
    await _executeFearRoll(makeActor({ talent: false }), 1, "important", 0, 0);
    expect(captured.chat.at(-1).content).not.toContain("Убийца Разума");
  });
});
