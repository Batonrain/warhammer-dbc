// test/rules/char-loss-portions.test.mjs
//
// Урон в Характеристики со своим темпом (task 1-8, решение Сергея 25.09.2026):
// порции с источником. Руна Сигиллита — «1 за 8 часов, не лечится
// психосилами/судьбой/медитацией»; перманентный урон из крит-таблиц — никогда.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { charLossAddFields, charLossTotal, charLossPortionsAddFields, charLossPortionsStep, charLossPortionsHeal,
         charHealAllFields, recoveryPolicy, SECONDS_PER_HOUR } from "../../module/rules/char-loss.mjs";

const H = SECONDS_PER_HOUR;
const sys = (portions = [], charLoss = {}) => ({
  characteristics: { t: { total: 30 }, wp: { total: 30 }, int: { total: 30 } },
  charLoss, charLossPortions: portions
});

describe("порции урона в Характеристики", () => {
  it("итог — обычный урон плюс порции этой Характеристики", () => {
    const s = sys([{ key: "wp", amount: 2 }, { key: "t", amount: 5 }], { wp: 1 });
    expect(charLossTotal(s, "wp")).toBe(3);
    expect(charLossTotal(s, "t")).toBe(5);
  });

  it("добавление: пол 0 с учётом уже снятого этим вызовом, свой период и отсчёт", () => {
    const s = sys();
    const { patch, applied } = charLossPortionsAddFields(s, [
      { key: "wp", amount: 20, hours: 8, noMagic: true, source: "руна" },
      { key: "wp", amount: 20, hours: 8 }
    ], 1000);
    expect(applied.wp).toBe(30);
    const list = patch["system.charLossPortions"];
    expect(list.map(p => p.amount)).toEqual([20, 10]);
    expect(list[0]).toMatchObject({ hours: 8, at: 1000 + 8 * H, noMagic: true, source: "руна" });
  });

  it("часы: 1 за свой период, не раньше until; перманентная не отходит", () => {
    const s = sys([
      { key: "wp", amount: 3, hours: 8, until: 0, at: 8 * H },
      { key: "wp", amount: 2, hours: 1, until: 24 * H, at: H },
      { key: "int", amount: 1, hours: 0, until: 0, at: 0 }
    ]);
    const out = charLossPortionsStep(s, recoveryPolicy([]), 16 * H);
    expect(out.find(p => p.hours === 8).amount).toBe(1);       // 8 ч и 16 ч
    expect(out.find(p => p.hours === 1).amount).toBe(2);       // ждёт суток
    expect(out.find(p => p.key === "int").amount).toBe(1);     // перманентный
  });

  it("блок политики (болезнь) держит и порции", () => {
    const s = sys([{ key: "t", amount: 2, hours: 1, until: 0, at: H }]);
    const pol = recoveryPolicy([{ kind: "charRecovery", target: "t", mode: "block" }]);
    expect(charLossPortionsStep(s, pol, 10 * H)).toBeNull();
  });

  it("лечение: сверхъестественное не трогает noMagic, перманентное не лечится ничем", () => {
    const s = sys([
      { key: "wp", amount: 2, hours: 8, noMagic: true },
      { key: "wp", amount: 2, hours: 1 },
      { key: "wp", amount: 1, hours: 0 }
    ]);
    expect(charLossPortionsHeal(s, "wp", 10, { magic: true }).healed).toBe(2);
    expect(charLossPortionsHeal(s, "wp", 10).healed).toBe(4);
  });

  it("лечение всех Характеристик разом не теряет порции предыдущих", () => {
    const s = sys([{ key: "t", amount: 2, hours: 1 }, { key: "wp", amount: 2, hours: 1 }]);
    const patch = charHealAllFields(s, 1);
    expect(patch["system.charLossPortions"].map(p => `${p.key}:${p.amount}`)).toEqual(["t:1", "wp:1"]);
  });
});

describe("первый отсчёт обычного урона — по действующему периоду", () => {
  it("Гниль Нургла (7 ч): первая единица отходит через 7 ч, а не через час", () => {
    const s = { characteristics: { s: { total: 40 } }, charLoss: {}, charLossAt: {} };
    expect(charLossAddFields(s, "s", 2, 1000, 7).patch["system.charLossAt.s"]).toBe(1000 + 7 * H);
    expect(charLossAddFields(s, "s", 2, 1000).patch["system.charLossAt.s"]).toBe(1000 + H);
  });
});
