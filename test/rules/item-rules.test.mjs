// Правила, которые предметы актора дают через Конструктор. Первый такой вид —
// «Переброс» (Локусы Герольдов); дальше тем же путём поедут остальные.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";

const SYSTEM = "warhammer-dbc";
let errors;
beforeEach(() => { errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => errors.mockRestore());

/** Предмет с одной И-группой Механики. */
const item = (name, entries, extraFlags = {}) => ({
  id: name, name,
  flags: { [SYSTEM]: { mechanics: [{ id: "g1", operator: "AND", entries }], ...extraFlags } }
});

const reroll = (over = {}) => ({
  id: "e1", kind: "reroll", rerollScope: "char", rerollChar: "ag",
  rerollMode: "keepBest", label: "", ...over
});

describe("rulesFromItemMechanics: сборка правил", () => {
  it("запись «Переброс» превращается в правило с эффектом rollMode", () => {
    const rules = rulesFromItemMechanics([item("Локус Грации", [reroll()])]);
    expect(rules).toEqual([{
      id: "item.Локус Грации.e1",
      label: "Локус Грации",
      when: {},
      // who — чей бросок перебрасывается; по умолчанию свой, см. capability.test.mjs
      effects: [{ kind: "rollMode", target: "char:ag", mode: "keepBest", rolls: 2, who: "self" }]
    }]);
  });

  it("подпись записи важнее имени предмета — у одной способности бывает два переброса", () => {
    const rules = rulesFromItemMechanics([item("Локус", [reroll({ label: "Переброс Ловкости" })])]);
    expect(rules[0].label).toBe("Переброс Ловкости");
  });

  it("области собираются из вида: навык, атака, инициатива, социальные, любой тест", () => {
    const cases = [
      [reroll({ rerollScope: "skill", skillKey: "dodge" }), "skill:dodge"],
      [reroll({ rerollScope: "attack" }), "attack"],
      [reroll({ rerollScope: "initiative" }), "initiative"],
      [reroll({ rerollScope: "social" }), "social"],
      [reroll({ rerollScope: "all" }), "all"]
    ];
    for (const [entry, target] of cases) {
      const rules = rulesFromItemMechanics([item("И", [entry])]);
      expect(rules[0].effects[0].target).toBe(target);
    }
  });

  it("режим «худший из двух» доезжает до правила", () => {
    const rules = rulesFromItemMechanics([item("И", [reroll({ rerollMode: "keepWorst" })])]);
    expect(rules[0].effects[0].mode).toBe("keepWorst");
  });
});

describe("rulesFromItemMechanics: что НЕ должно давать правил", () => {
  it("выключенный предмет правил не даёт — иначе Локус действовал бы всегда", () => {
    const off = item("Локус Грации", [reroll()]);
    expect(rulesFromItemMechanics([off], () => false)).toEqual([]);
  });

  it("прочие виды записи здесь не при чём", () => {
    expect(rulesFromItemMechanics([item("Черта", [{ id: "e", kind: "characteristic" }])])).toEqual([]);
  });

  it("ИЛИ-ветки пропускаются: там выбор делается один раз при выдаче", () => {
    const or = { id: "x", name: "x", flags: { [SYSTEM]: {
      mechanics: [{ id: "g", operator: "OR", entries: [reroll()] }] } } };
    expect(rulesFromItemMechanics([or])).toEqual([]);
  });

  it("незаполненная область характеристики отбрасывается с жалобой", () => {
    expect(rulesFromItemMechanics([item("И", [reroll({ rerollChar: "" })])])).toEqual([]);
    expect(errors).toHaveBeenCalled();
  });

  it("предмет без Механики молчит, и пустой список тоже", () => {
    expect(rulesFromItemMechanics([{ id: "a", name: "a", flags: {} }])).toEqual([]);
    expect(rulesFromItemMechanics([])).toEqual([]);
    expect(rulesFromItemMechanics(undefined)).toEqual([]);
  });
});

describe("rulesFromItemMechanics: вложенные подгруппы", () => {
  it("И-подгруппа внутри И-группы просматривается", () => {
    const nested = item("И", [
      { id: "g2", kind: "group", group: { id: "g2", operator: "AND", entries: [reroll()] } }
    ]);
    expect(rulesFromItemMechanics([nested])).toHaveLength(1);
  });
});
