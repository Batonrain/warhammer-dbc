// test/combat/movement-two-handed-penalty.test.mjs
//
// wdbc-x1nz.2.97 п.3 («Раны и Урон», стр. 43): «Ладонь: Штраф –20 на все
// тесты, что требуют двух рук» (Рука — «также как ладонь»). Решение
// владельца: тесты «двумя руками» — Карабканье и приёмы Борьбы, когда цель
// держат двумя руками (Метнуть/Замахнуться). Многорукому — по бюджету рук.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _resolveClimb } from "../../module/combat/movement-actions.mjs";
import { _withTwoHandedGrapplePenalty } from "../../module/combat/grapple.mjs";

function climber(conditions = {}) {
  return {
    name: "Подставной", items: [],
    system: { conditions, fatigue: { value: 0, max: 0 }, characteristics: { s: { total: 35 } } }
  };
}

beforeEach(resetCaptured);

describe("Карабканье без кисти/руки — −20", () => {
  it("простой склон: порог Athletics 40 − 20 = 20, бросок 30 — провал", async () => {
    captured.dice = [30];
    await _resolveClimb(climber({ lostHands: true, lostHandsCount: 1 }), "simple", 40, 0, 0, 8);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Провал");
    expect(html).toContain("Без кисти/руки");
  });

  it("без потерь тот же бросок 30 — успех", async () => {
    captured.dice = [30];
    await _resolveClimb(climber(), "simple", 40, 0, 0, 8);
    expect(captured.chat.at(-1).content).toContain("Успех");
  });

  it("потеря РУКИ — тот же штраф (верёвка: 40 + 10 − 20 = 30, бросок 35 — провал)", async () => {
    captured.dice = [35, 1];
    await _resolveClimb(climber({ lostArms: true, lostArmsCount: 1 }), "rope", 40, 0, 0, 8);
    expect(captured.chat.at(-1).content).toContain("Провал");
  });

  it("отвесный склон: штраф в обоих Пределах", async () => {
    captured.dice = [5];
    await _resolveClimb(climber({ lostHands: true, lostHandsCount: 1 }), "sheer", 40, 40, 0, 8);
    // Athletics 40 −10 −20 = 10, Acrobatics 40 −20 = 20
    const html = captured.chat.at(-1).content;
    expect(html).toContain("<b>10</b>");
    expect(html).toContain("<b>20</b>");
  });
});

describe("Борьба: Метнуть/Замахнуться двумя руками без кисти/руки — −20", () => {
  const mods = () => ({ list: [], total: 5, parts: ["Что-то +5"] });
  const grappler = (hands, conditions = {}) => ({
    system: { conditions },
    items: [],
    getFlag: (_ns, key) => (key === "grappleHands" ? hands : undefined)
  });

  it("держит двумя руками и потерял кисть — −20 к сбору", () => {
    const out = _withTwoHandedGrapplePenalty(mods(), grappler(2, { lostHandsCount: 1 }));
    expect(out.total).toBe(-15);
    expect(out.parts.at(-1)).toContain("Без кисти/руки");
  });

  it("держит одной рукой — штрафа нет, тест не «двуручный»", () => {
    const out = _withTwoHandedGrapplePenalty(mods(), grappler(1, { lostHandsCount: 1 }));
    expect(out.total).toBe(5);
  });

  it("двумя руками, но без потерь — штрафа нет", () => {
    const out = _withTwoHandedGrapplePenalty(mods(), grappler(2));
    expect(out.total).toBe(5);
  });
});
