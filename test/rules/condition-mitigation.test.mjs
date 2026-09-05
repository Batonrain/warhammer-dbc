// «Смягчение» Состояния (wdbc-tl0f, kind:"condition" режима "mitigate"):
// запись автора контента вытесняет книжное правило Состояния из реестра
// (rules/library/conditions.mjs) и, в режиме «половина», подставляет вместо
// него ополовиненную копию.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { selectRules } from "../../module/rules/collect.mjs";
import { CONDITION_RULES, conditionRulesFor } from "../../module/rules/library/conditions.mjs";

const SYSTEM = "warhammer-dbc";
let errors;
beforeEach(() => { errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => errors.mockRestore());

const item = (name, entries) => ({
  id: name, name, flags: { [SYSTEM]: { mechanics: [{ id: "g1", operator: "AND", entries }] } }
});

const cond = (over = {}) => ({
  id: "e1", kind: "condition", condKey: "prone", condMode: "mitigate",
  condMitigate: "ignore", ...over
});

const actorWith = (...conditions) => ({
  system: { conditions: Object.fromEntries(conditions.map(k => [k, true])) }, items: []
});

describe("conditionRulesFor", () => {
  it("находит книжное правило по ключу Состояния", () => {
    expect(conditionRulesFor("prone").map(r => r.id)).toEqual(["conditions.prone"]);
  });

  it("ключ внутри списка нескольких Состояний тоже находится", () => {
    expect(conditionRulesFor("lostFeet").map(r => r.id)).toEqual(["conditions.lostFeetOrLegs"]);
    expect(conditionRulesFor("lostLegs").map(r => r.id)).toEqual(["conditions.lostFeetOrLegs"]);
  });

  it("Состояние без числового штрафа в реестре — пусто", () => {
    expect(conditionRulesFor("bleeding")).toEqual([]);
    expect(conditionRulesFor("")).toEqual([]);
  });
});

describe("mitigate: «штрафа нет вовсе»", () => {
  it("даёт правило-носитель, вытесняющее книжное", () => {
    const rules = rulesFromItemMechanics([item("Панцирь", [cond()])]);
    expect(rules).toEqual([{
      id: "item.Панцирь.e1", label: "Панцирь", when: {}, effects: [],
      overrides: ["conditions.prone"]
    }]);
  });

  it("после отбора книжное правило Поваленного действительно снято", () => {
    const rules = rulesFromItemMechanics([item("Панцирь", [cond()])]);
    const picked = selectRules([...CONDITION_RULES, ...rules], actorWith("prone"), {});
    expect(picked.map(r => r.id)).not.toContain("conditions.prone");
  });

  it("без предмета книжное правило на месте — иначе тест ничего не доказывал бы", () => {
    const picked = selectRules([...CONDITION_RULES], actorWith("prone"), {});
    expect(picked.map(r => r.id)).toContain("conditions.prone");
  });
});

describe("mitigate: «половина штрафа»", () => {
  it("подставляет копию с ополовиненными значениями", () => {
    const rules = rulesFromItemMechanics([item("Наколенники", [cond({ condMitigate: "half" })])]);
    const half = rules.find(r => r.id === "item.Наколенники.e1.half.conditions.prone");
    expect(half.when).toEqual({ hasCondition: ["prone"] });
    expect(half.effects).toEqual([
      { kind: "rollBonus", target: "weapon:melee", value: -10 },
      { kind: "rollBonus", target: "skill:dodge",  value: -10 },
      { kind: "rollBonus", target: "skill:stealth", value: 10 }
    ]);
  });

  it("книжное правило при этом всё равно вытеснено — штраф не задваивается", () => {
    const rules = rulesFromItemMechanics([item("Наколенники", [cond({ condMitigate: "half" })])]);
    const picked = selectRules([...CONDITION_RULES, ...rules], actorWith("prone"), {});
    expect(picked.map(r => r.id)).not.toContain("conditions.prone");
    expect(picked.map(r => r.id)).toContain("item.Наколенники.e1.half.conditions.prone");
  });
});

describe("mitigate: книжное правило на несколько Состояний сразу", () => {
  it("смягчение одного не снимает штраф второго — тому возвращается полная копия", () => {
    const rules = rulesFromItemMechanics([item("Протезы", [cond({ condKey: "lostFeet" })])]);
    const rest = rules.find(r => r.id.endsWith(".rest.conditions.lostFeetOrLegs"));
    expect(rest.when.hasCondition).toEqual(["lostLegs"]);
    expect(rest.effects).toEqual(conditionRulesFor("lostFeet")[0].effects);
  });

  it("у актора с потерей ног штраф остаётся, у актора с потерей стоп — уходит", () => {
    const rules = rulesFromItemMechanics([item("Протезы", [cond({ condKey: "lostFeet" })])]);
    const all = [...CONDITION_RULES, ...rules];
    const legs = selectRules(all, actorWith("lostLegs"), {});
    const feet = selectRules(all, actorWith("lostFeet"), {});
    expect(legs.some(r => r.effects?.length && r.id.includes("lostFeetOrLegs"))).toBe(true);
    expect(feet.some(r => r.effects?.length && r.id.includes("lostFeetOrLegs"))).toBe(false);
  });
});

describe("mitigate: что правилом НЕ становится", () => {
  it("Состояние без числового штрафа в реестре смягчать нечем", () => {
    expect(rulesFromItemMechanics([item("Жгут", [cond({ condKey: "bleeding" })])])).toEqual([]);
  });

  it("остальные три режима той же записи правил не дают — они не про броски", () => {
    for (const mode of ["apply", "remove", "immunity"]) {
      expect(rulesFromItemMechanics([item("Х", [cond({ condMode: mode })])])).toEqual([]);
    }
  });

  it("пустой ключ Состояния — записи нет", () => {
    expect(rulesFromItemMechanics([item("Х", [cond({ condKey: "" })])])).toEqual([]);
  });
});
