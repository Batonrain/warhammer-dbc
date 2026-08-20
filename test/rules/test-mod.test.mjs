// Вид записи «Модификатор теста» (kind:"testMod") и область «Нестабильность».
// Первый потребитель — Локус Цепей: «+Inf герольда на все тесты Нестабильности».

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rollModsFromRules } from "../../module/rules/resolve-test.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";

const SYSTEM = "warhammer-dbc";
let errors;
beforeEach(() => { errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => errors.mockRestore());

const item = (name, entries) => ({
  id: name, name,
  flags: { [SYSTEM]: { mechanics: [{ id: "g", operator: "AND", entries }] } }
});
const testMod = (over = {}) => ({
  id: "e1", kind: "testMod", modScope: "instability",
  modValueMode: "flat", value: 5, modCharBonus: "inf", label: "", ...over
});

describe("область «Нестабильность»", () => {
  const rule = { id: "r", label: "Локус Цепей", when: {}, effects: [
    { kind: "rollBonus", target: "instability", value: 4 }
  ] };

  it("модификатор доходит до теста Нестабильности", () => {
    expect(rollModsFromRules([rule], { kind: "instability" }))
      .toEqual([{ ruleId: "r", label: "Локус Цепей", value: 4, halvePenalty: false }]);
  });

  it("и не примазывается к обычному тесту Воли: это разные правила книги", () => {
    expect(rollModsFromRules([rule], { kind: "skill", char: "wp" })).toEqual([]);
  });
});

describe("значение от своей характеристики", () => {
  const rule = { id: "r", label: "Цепи", when: {}, effects: [
    { kind: "rollBonus", target: "instability", valueFrom: { selfCharBonus: "inf" } }
  ] };

  it("берётся бонус характеристики САМОГО актора, а не цели", () => {
    const actor = { system: { characteristics: { inf: { bonus: 6 } } } };
    expect(rollModsFromRules([rule], { kind: "instability", actor })[0].value).toBe(6);
  });

  it("нет актора или характеристики — ноль, без падения посреди броска", () => {
    expect(rollModsFromRules([rule], { kind: "instability" })[0].value).toBe(0);
  });
});

describe("запись Конструктора «Модификатор теста»", () => {
  it("плоское число превращается в rollBonus нужной области", () => {
    const rules = rulesFromItemMechanics([item("Локус Цепей", [testMod()])]);
    expect(rules[0].effects).toEqual([{ kind: "rollBonus", target: "instability", value: 5 }]);
  });

  it("режим «бонус характеристики» пишет valueFrom, а не число", () => {
    const rules = rulesFromItemMechanics([item("Локус Цепей", [
      testMod({ modValueMode: "charBonus", modCharBonus: "inf" })
    ])]);
    expect(rules[0].effects).toEqual([
      { kind: "rollBonus", target: "instability", valueFrom: { selfCharBonus: "inf" } }
    ]);
  });

  it("области берутся те же, что у Переброса", () => {
    const rules = rulesFromItemMechanics([item("И", [testMod({ modScope: "char", rerollChar: "wp" })])]);
    expect(rules[0].effects[0].target).toBe("char:wp");
  });

  it("незаполненная область отбрасывается с жалобой", () => {
    expect(rulesFromItemMechanics([item("И", [testMod({ modScope: "char", rerollChar: "" })])])).toEqual([]);
    expect(errors).toHaveBeenCalled();
  });
});
