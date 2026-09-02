// test/rules/enchanting-voice.test.mjs
//
// Enchanting Voice / Чарующий Голос (wdbc-1rno): «+½Cor (окр.▲) на все тесты
// социального взаимодействия...» — kind:"testMod", modValueMode:"charBonus",
// modCharBonus:"cor", multiplier 0.5 (module/rules/resolve-test.mjs — новый
// источник значения "cor", округляет вверх). Исключения книги («но не
// встречные... кроме как против Кхорнитов») НЕ применены — самоотчёт игрока,
// как остальные подобные оговорки в системе; шире книги, задокументировано.

import { describe, it, expect } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { rollModsFromRules } from "../../module/rules/resolve-test.mjs";

const item = {
  id: "gift1", name: "Enchanting Voice / Чарующий Голос",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "testMod", modScope: "social", modValueMode: "charBonus",
      modCharBonus: "cor", modCharBonusMultiplier: 0.5, label: "Чарующий Голос" }
  ] }] } }
};

describe("Enchanting Voice: +½Cor.b (окр.▲) на социальные тесты (wdbc-1rno)", () => {
  it("запись превращается в rollBonus с valueFrom selfCharBonus:cor", () => {
    const rules = rulesFromItemMechanics([item]);
    expect(rules[0].effects).toEqual([
      { kind: "rollBonus", target: "social", valueFrom: { selfCharBonus: "cor", multiplier: 0.5 } }
    ]);
  });

  it("на тесте социального Навыка (Charm) даёт округлённый вверх бонус", () => {
    const rules = rulesFromItemMechanics([item]);
    const actor = { system: { corruptionBonus: 5 } };
    const mods = rollModsFromRules(rules, { kind: "skill", skill: "charm", actor });
    expect(mods).toEqual([{ ruleId: "item.Enchanting Voice / Чарующий Голос.e", label: "Чарующий Голос", value: 3, halvePenalty: false }]);
  });

  it("на несоциальном тесте бонус не участвует", () => {
    const rules = rulesFromItemMechanics([item]);
    const actor = { system: { corruptionBonus: 5 } };
    const mods = rollModsFromRules(rules, { kind: "skill", skill: "athletics", actor });
    expect(mods).toEqual([]);
  });
});
