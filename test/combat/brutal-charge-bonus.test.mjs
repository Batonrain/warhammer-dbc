// test/combat/brutal-charge-bonus.test.mjs
//
// brutalChargeDamageBonus (module/combat/attack.mjs, wdbc-sk8s) — раньше
// НИ ОДИН из двух трейтов "Brutal Charge" не читался нигде (оба сами
// отмечали это в своих notes). Эти тесты проверяют только саму функцию —
// подключение к rofMode==="charge" в flatBonus не тестируется отдельно
// (нет unit-теста на весь _executeAttackRoll, слишком тяжёлый пайплайн).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { brutalChargeDamageBonus } from "../../module/combat/attack.mjs";

function actorWithTraits(traits, wsBonus = 0) {
  return {
    items: traits,
    system: { characteristics: { ws: { bonus: wsBonus } } }
  };
}

describe("brutalChargeDamageBonus", () => {
  it("нет трейтов — 0", () => {
    expect(brutalChargeDamageBonus(actorWithTraits([]))).toBe(0);
  });

  it("общий Brutal Charge (X) — берёт system.rating", () => {
    const actor = actorWithTraits([
      { type: "trait", name: "Brutal Charge / Брутальный Натиск (X)", system: { rating: 3 } }
    ]);
    expect(brutalChargeDamageBonus(actor)).toBe(3);
  });

  it("вариант Суккубы Brutal Charge (WS.b) — берёт живой Бонус WS актора, не rating", () => {
    const actor = actorWithTraits([
      { type: "trait", name: "Brutal Charge (WS.b) / Жестокий Натиск", system: { rating: 0 } }
    ], 5);
    expect(brutalChargeDamageBonus(actor)).toBe(5);
  });

  it("оба трейта сразу — складываются", () => {
    const actor = actorWithTraits([
      { type: "trait", name: "Brutal Charge / Брутальный Натиск (X)", system: { rating: 2 } },
      { type: "trait", name: "Brutal Charge (WS.b) / Жестокий Натиск", system: { rating: 0 } }
    ], 4);
    expect(brutalChargeDamageBonus(actor)).toBe(6);
  });

  it("не-Черта (kind talent) с похожим именем игнорируется", () => {
    const actor = actorWithTraits([
      { type: "talent", name: "Brutal Charge / Брутальный Натиск (X)", system: { rating: 3 } }
    ]);
    expect(brutalChargeDamageBonus(actor)).toBe(0);
  });

  it("без актора/без items не падает", () => {
    expect(brutalChargeDamageBonus(null)).toBe(0);
    expect(brutalChargeDamageBonus({})).toBe(0);
  });
});
